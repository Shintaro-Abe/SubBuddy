# 家族共有スコープの最小モデリング設計（容量ゲート フォローアップ）

> ステアリング：`.steering/20260625-capacity-gate-followup/`
> 作成日：2026-06-25 / 区分：**設計のみ（実装は別スパイク）**
> 前提：`.steering/20260623-icloud-plus-capacity-gate/`（容量ゲート実装・コミット済み 3cb37c9）
> 関連：`research/20260621-icloud-capacity-acquisition/investigation.md` §4.2 / §4.3
> 📖 専門用語は残し、初出に「（＝平たい言い換え）」を添える。

---

## 1. なぜ今これを設計するか

容量ゲートは「使用容量が下位プランに安全に収まるか」を見て、iCloud+ のダウングレードを安全に提案する。
いまの実装は使用容量を **1つの数値**（`Subscription.usedCapacityGb`）として持つ。だが iCloud+ は**家族共有（ファミリー共有）**で使われることが多く、ここに落とし穴がある。

- ストレージ画面に出る数値が「**自分だけの使用量**」なのか「**家族全員の合計**」なのか、現状のモデルでは区別できない。
- 区別しないまま「下位プランで足りる」と判定すると、**他の家族メンバーを容量不足に追い込む**おそれがある（先行調査 §5・codex 反証の指摘）。
- さらに「容量が足りるか（＝使用量の評価）」と「費用を誰が負担しているか（＝支払いの評価）」は**別の話**。支払いは本人でも、容量は家族全体で食い合う、という組み合わせがある。

つまり、**使用量のスコープ（＝誰の使用量か）**と**費用のスコープ（＝誰の支払いか）**を分けて持たない限り、容量ゲートの判定は家族共有下で安全に成立しない。本ドキュメントはその最小モデリングを設計する（実装はしない）。

---

## 2. いまのモデル（出発点）と限界

```prisma
model Subscription {
  // 容量ゲート用（2026-06-23 追加・コミット済み）
  planCapacityGb    Int?      // 契約プラン容量(GB)
  usedCapacityGb    Int?      // 使用容量(GB) ← スコープ情報を持たない
  capacityCheckedAt DateTime? // 確認日時（鮮度判定）
}
```

| 限界 | 影響 |
|---|---|
| 使用量が単一値で、個人/家族全体の区別が無い | 家族合計を個人と誤認 → 過小評価でダウングレード誤提案 |
| 契約属性（プラン）と観測値（使用量）が同じ行に同居 | 履歴が残らず、誤入力修正・増加傾向の判定ができない |
| 費用スコープの概念が無い | 「支払いは本人・容量は家族全体」を表現できない |

> 容量ゲート自体は安全側（容量未入力なら断定しない）に倒してあるので、いまの単一値モデルでも**誤って強い断定はしない**。本設計は「家族共有でも積極的に正しい提案を出せる」段へ進めるための土台づくりであり、現状を壊す修正ではない。

---

## 3. 目標モデル：`CapacityUsageSnapshot`（観測値を別テーブルに分離）

契約属性（プラン）と観測値（使用量）を分け、観測値は**時系列スナップショット**として持つ。先行調査 §4.2 のカラム案を、容量ゲートの判定に必要な最小形へ落とす。

```prisma
model CapacityUsageSnapshot {
  id             String   @id @default(cuid())
  subscriptionId String   @map("subscription_id")
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  planCapacityGb Int      @map("plan_capacity_gb")  // 観測時点の契約プラン容量
  usedCapacityGb Int      @map("used_capacity_gb")  // 観測した使用容量
  capturedAt     DateTime @map("captured_at")        // 観測日時（鮮度判定の基準）

  source         CapacitySource  @default(manual)     // manual / ocr / billing_email
  confirmedByUser Boolean        @default(true) @map("confirmed_by_user") // 取得源と確認状態は別概念

  usageScope     CapacityScope   @default(individual) @map("usage_scope")  // この使用量は 個人 か 家族全体 か
  costScope      CapacityScope   @default(individual) @map("cost_scope")   // この費用は 個人負担 か 家族負担 か
  usedForBackup  Boolean?        @map("used_for_backup")                    // 端末バックアップ用途か（任意・将来）

  createdAt      DateTime @default(now()) @map("created_at")

  @@index([subscriptionId, capturedAt])
  @@map("capacity_usage_snapshot")
}

enum CapacitySource { manual ocr billing_email }
enum CapacityScope  { individual familyTotal }
```

設計上の要点（先行調査 §4.2・§6 の反証反映）：

- **`source` と `confirmedByUser` を分離**：取得源（手入力/OCR/請求逆引き）と「ユーザーが確認済みか」は別。OCR 値は `confirmedByUser=false` のまま判定に使わない。
- **`usageScope` と `costScope` を分離**：容量の評価と費用の評価は別概念。混同しない。
- **時系列を残す**：最新1件で判定しつつ、過去複数件で**増加傾向**が見えれば下位プラン判定を弱められる（誤入力修正にも効く）。データ量は小さい。
- **無料枠 5GB は持たない**：定数としてコード側に保持（誤入力源を断つ）。

---

## 4. スコープ分離が判定に与える意味

容量ゲート（`smallestFittingPlan` の入口）で、**使うべき使用量はスコープによって変わる**。

| usageScope | 容量ゲートの扱い |
|---|---|
| `individual`（自分の使用量とユーザーが確認済み） | そのまま「下位プランに収まるか」を判定してよい |
| `familyTotal`（家族全員の合計） | **その値で下位プランを判定してはいけない**。下げると他メンバーが不足し得る。→ 「家族全体の使用量です。本人分が分かれば判定できます」と保留（needs_capacity_check 相当） |

費用面（`costScope`）は別レーンで扱う：

| costScope | 費用評価の扱い |
|---|---|
| `individual` | 節約額はそのまま本人のメリットとして提示してよい |
| `familyTotal` | プラン料金は家族で割り勘の可能性。節約額を本人の確定メリットとして断定しない（「目安」継続） |

> つまりスコープは「強い断定を**抑制する**ための安全弁」。`individual` と明示・確認できたときだけ積極的な提案に進み、`familyTotal` や不明は保留に倒す。容量ゲートの既存方針（断定しない側へ倒す）と一貫する。

---

## 5. 移行戦略（後付け・非破壊）

既存の `Subscription` 直置き3フィールドは**壊さず**、スナップショットを**足す**。両者は矛盾せず共存できる（容量ゲート設計 §3 の但し書きと一致）。

### 段階

1. **テーブル追加（additive migration）**：`CapacityUsageSnapshot` と2つの enum を追加。既存データ・既存挙動に影響なし。
2. **書き込みの二重化（dual-write）**：`CapacityInput` の保存時に、従来の `Subscription` 3フィールド更新に加えてスナップショットを1件 insert。`usageScope`/`costScope` は入力に追加（既定 `individual`）。
3. **読み出しの切替**：`recompute.ts` が「最新スナップショット」を読むよう変更（無ければ従来の `Subscription` 直置きにフォールバック）。`daysSinceCapacityCheck` は `capturedAt` 起点に。
4. **判定の精緻化**：`computeRecommendation` の P3 ゲートに usageScope 分岐（§4）を追加。`familyTotal`/未確認は保留へ。
5. **直置きフィールドの非推奨化（任意・将来）**：スナップショット運用が安定したら `Subscription` の3フィールドは読み取り専用フォールバック扱いにし、いずれ撤去を検討（本スパイク外）。

### 非破壊である理由

- 追加テーブル・追加 enum・追加任意フィールドのみ。既存カラムの型変更・削除なし。
- スナップショットが無いサブスクは従来パスで動く（フォールバック）。
- 判定は「スコープ不明なら保留」に倒すので、移行途中でも誤った強い断定は出ない。

---

## 6. 入力UXへの影響（最小）

- 容量入力フォームに **「この使用量は誰の分？」** の選択を1つ足す（既定＝自分の分）。
  - 選択肢：「自分の使用量」/「家族全体の合計」。後者を選んだら判定は保留にし、本人分の確認を促す。
- 費用スコープ（割り勘か）は**入力を増やしすぎない**ため、初期は既定 `individual` 固定でよい。家族プランの費用按分は別テーマ（過剰設計を避ける）。
- 既存の鮮度・単位・Apple確認導線（本セッションの UX 磨き込み）はそのまま活きる。

---

## 7. このスパイクのスコープ境界

| やる（設計のみ） | やらない（別スパイク／別テーマ） |
|---|---|
| スナップショットのスキーマ設計・移行段階の定義 | 実装・マイグレーション・テスト |
| usageScope/costScope が判定に与える意味の定義 | 家族プランの費用按分（割り勘）モデルの本格化 |
| 入力UXへの最小影響の整理 | OCR/請求逆引きの取得実装（→ `requirements-ocr.md`・別調査） |
| 非破壊な移行順序 | 増加傾向判定（複数スナップショットの傾向分析）の本実装 |

---

## 8. 次アクション（実装着手時の最初の一手）

1. `CapacityUsageSnapshot` + enum2種を additive migration で追加（既存無影響を確認）。
2. `CapacityInput` を dual-write 化し、usageScope の選択を追加。
3. `recompute.ts` を最新スナップショット読みに切替（フォールバック付き）。
4. `computeRecommendation` P3 ゲートに usageScope 分岐を追加し、テスト観点（§4 の表）を `computeRecommendation.test.ts` に追加。

> 着手判断は別途。家族共有の実需（実際に familyTotal 入力が混ざるか）を1〜2の実利用で確認してからでも遅くない。容量ゲートは既に安全側に倒れているため、本移行は「精度を上げる強化」であって「不具合修正」ではない。
