# iCloud+ 容量ゲート判定の実装：設計

> ステアリング：`.steering/20260623-icloud-plus-capacity-gate/`
> 作成日：2026-06-23
> 前提：`requirements.md`（承認済み）
> 関連：`.steering/20260609-quantitative-recommendation-engine/design.md`（既存エンジン本体）
> 📖 専門用語は残し、初出に「（＝平たい言い換え）」を添える。

---

## 1. 実装アプローチ

既存の「安いプランがある」判定（P3）に、iCloud+（`usageType==="capacity"`）のときだけ**容量ゲート（＝安全確認の関門）**を足す。**新しい判定パターンは作らない。** 容量は新しい主張ではなく、P3 の確度を上げる「証拠」として扱う。

2段構えで価値を出す：

| 段 | 内容 | コスト |
|---|---|---|
| 第1段（最優先） | **重複クラウド費用の発見**。iCloud+・Google One・Dropbox・OneDrive は **seed に登録済み（`cloud_storage`／代替関係あり）で、既に P2／P4 が発火している**。新規登録は不要 | コード変更なし（**検証のみ**） |
| 第2段（本命） | **ダウングレード可否の安全判断**。P3 に容量ゲートを足す | 後述の実装 |

### 実コード確認で判明した前提（2026-06-23）

| 事実 | 根拠 | 影響 |
|---|---|---|
| iCloud+ と他クラウドは seed 登録済み | `prisma/seed/service-catalog.json` 181–227行 | 第1段は新規作業なし＝検証のみ |
| iCloud+ には既にプラン（50/200/2TB）が入っており、**現状すでに容量チェック無しでダウングレード提案（P3）が出ている** | `recompute.ts` 100–116行＋seed | §「既存挙動の変更」を参照（要承認・承認済み） |
| `MatchedPattern` 型に追加する `status` は、保存はされるが**読み戻し（`parseMatchedPatterns`）で捨てられる** | `matchedPatterns.ts` 25–30行／詳細画面 `[id]/page.tsx` 132行 | 読み戻し改修タスクを追加（§6.2） |
| `ServicePlan` に容量(GB)フィールドが無い | `schema.prisma` | 容量ゲートに必要。フィールド追加（§3.1）|
| P3 の evidence 文言は `reasons.ts` ではなく `computeRecommendation.ts` で生成 | `matchPatternsP2toP6` | 文言の修正場所を訂正（§8）|

### 既存挙動の変更（要承認・承認済み 2026-06-23）

現状、iCloud+ にプランがあるため「自分より安いプランがあれば提案」する既存ロジックで、**使用容量を確認しないままダウングレード提案（`consider_downgrade`）が出ている**。容量ゲート導入後は、容量未入力だと **`review`＋「使用容量を確認」** に弱まる。これは機能削除ではなく**安全化**だが、ユーザーの見え方が変わる変更のため明示して承認を得た。

---

## 2. 変更するコンポーネント

| コンポーネント | 変更内容 |
|---|---|
| `prisma/schema.prisma` | `Subscription` に容量3フィールド（任意）／`ServicePlan` に `capacityGb`（任意）を追加 |
| `apps/web/src/domain/capacity/fit.ts`（新規） | 「使用量が安全に収まる最小プラン」を選ぶ純粋関数 |
| `config/scoring.ts` | 容量ゲート用しきい値（鮮度日数・安全バッファ）を追加 |
| `computeRecommendation.ts` | 入力型に容量フィールド追加。P3 分岐に容量ゲート（status 付与・evidence 文言） |
| `matchedPatterns.ts` | `parseMatchedPatterns`／`isMatchedPattern` を `status` を保持するよう改修（読み戻しの穴対策） |
| `recompute.ts`（取りまとめ） | iCloud+ の容量フィールド・鮮度・容量つき候補プランを入力に詰める |
| `prisma/seed/service-catalog.json` | **登録済み（検証のみ）**。iCloud+ 各プランに `capacityGb` を付与する追記のみ |
| 詳細画面 | iCloud+ 詳細に just-in-time の容量入力 UI。節約額の「目安」ラベル・安全条件の文言 |
| `computeRecommendation.test.ts` | 容量ゲートのテストを追加 |
| `docs/`（PRD 6.3・functional-design・glossary） | 別タスクで改訂 |

### 変更しないもの

| 対象 | 理由 |
|---|---|
| P1（使っていない）〜P6 のロジック | capacity は時間軸判定に干渉しない。P3 への分岐追加のみ |
| `Decision` enum | 既存値を流用（断定→`consider_downgrade`、確認プロンプト→`review`） |
| 判定パターンの集合（P1〜P7） | 新パターンを増やさない（C-1） |

---

## 3. データモデルの変更（最小・任意フィールド）

`Subscription` に容量3フィールドを**任意**で追加する。必須入力にしない（C-2）。

```prisma
model Subscription {
  // ── 既存フィールド（変更なし） ──
  // ...

  // ── 追加（すべて任意） ──
  planCapacityGb      Int?      @map("plan_capacity_gb")
  // 契約中プランの容量(GB)。価格から逆算しない（価格は一意に決まらないため）
  usedCapacityGb      Int?      @map("used_capacity_gb")
  // 使用容量(GB)。手入力 or OCR確認値
  capacityCheckedAt   DateTime? @map("capacity_checked_at")
  // 容量を確認した日時（鮮度判定に使用）
}
```

> **設計判断**：当面は `Subscription` 直置きの任意3フィールドで足りる。時系列・信頼度・スコープ（個人/家族）を本格管理する段になったら、先行調査（`research/20260621-...`）の `CapacityUsageSnapshot` テーブルへ移行する。両者は矛盾せず後付け可能（requirements §9 で別スパイク化済み）。

### 3.1 ServicePlan に容量(GB)を追加（容量ゲートに必須）

容量ゲートは「下位プランの容量にユーザーの使用量が収まるか」を見る。だが既存 `ServicePlan` は `name`（"50GB" 等の文字列）と `monthlyPrice` しか持たず、**容量を数値で持っていない**。文字列解析は脆いので、容量を明示フィールドで持つ。

```prisma
model ServicePlan {
  // ── 既存（変更なし） ──
  // name / monthlyPrice / isFreeTier / verifiedAt / sourceUrl ...

  // ── 追加（任意：容量型サービスのみ設定） ──
  capacityGb Int? @map("capacity_gb")
}
```

seed の iCloud+ 各プランに `capacityGb`（50/200/2000）を付与する。価格は既存のカタログ値を保持し（ゲートは価格を消さない）、UI で「目安」と明示する。

---

## 4. 容量が収まる下位プランの選択（新規・純粋関数）

`apps/web/src/domain/capacity/fit.ts`

設計を「1つ下のティア」ではなく **「使用量が安全に収まる"最小"の下位プラン」** に修正（修正前は隣のティア固定で、もっと下げられるケースを取りこぼした）。カタログの `ServicePlan`（価格つき）を入力に取り、安全バッファ込みで収まる中で最小容量のプランを返す。価格はカタログ値をそのまま使う（ゲートは価格を消さない。一意でない旨は UI で「目安」と明示）。

```typescript
export interface PlanCandidate {
  name: string;        // 例 "50GB"
  monthlyPrice: number; // カタログ価格（目安）
  capacityGb: number;   // ServicePlan.capacityGb
}

// 使用量が「安全に収まる」中で最小容量の下位プランを返す（無ければ null）
export function smallestFittingPlan(
  usedGb: number,
  candidates: PlanCandidate[],   // 自分より安い有料プラン（recompute が抽出）
  cfg: { bufferGb: number; bufferRatio: number },
): PlanCandidate | null {
  const fitting = candidates.filter((p) => {
    const buffer = Math.max(cfg.bufferGb, Math.round(p.capacityGb * cfg.bufferRatio));
    return usedGb + buffer <= p.capacityGb;
  });
  if (fitting.length === 0) return null;
  return fitting.reduce((min, p) => (p.capacityGb < min.capacityGb ? p : min));
}
```

無料枠5GBは候補に含めない（`isFreeTier` 除外は既存ロジックのまま）。

---

## 5. config/scoring.ts の追加

```typescript
export const scoringConfigSchema = z.object({
  // ── 既存（維持） ──
  // ...
  // ── 容量ゲート（iCloud+） ──
  capacityFreshnessDays: z.number().int().min(1).default(30),   // この日数以内なら鮮度OK
  capacitySafetyBufferGb: z.number().int().min(0).default(5),   // 安全バッファの下限GB
  capacitySafetyBufferRatio: z.number().min(0).max(1).default(0.1), // 下位容量に対する割合
});
```

> 安全バッファ `max(5GB, 下位容量×10%)` は**経験則（設計判断）**。反証条件：実利用で過小／過大と分かれば config で調整。

---

## 6. 判定ロジック（既存 P3 ブランチへのゲート追加）

### 6.1 入力型の拡張（`RecommendationInput`）

```typescript
export interface RecommendationInput {
  // ── 既存（維持） ──
  // ...
  cheaperPlan: CheaperOption | null; // P3 用。iCloud+ では「1つ下のプラン」を recompute が解決

  // ── 追加（任意） ──
  usedCapacityGb: number | null;
  daysSinceCapacityCheck: number | null;     // recompute が capacityCheckedAt から算出
  cheaperPlanCandidates: PlanCandidate[];     // capacity 型のゲート用：自分より安い有料プラン（容量つき）。非 capacity は空配列
}
```

### 6.2 MatchedPattern に確度状態を追加

P3 だけが使う「確認待ち」状態を表す。他パターンには影響しない。実コードでは `MatchedPattern` は `interface` ではなく **`type` エイリアス**（Prisma の Json 入力型に合わせるため）なので、その形を保ったまま任意フィールドを足す。

```typescript
export type MatchedPattern = {
  pattern: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  label: string;
  evidence: string;
  caveat?: string;
  status?: "confirmed" | "needs_capacity_check"; // P3(capacity)専用。既定は confirmed
};
```

> **重要（読み戻しの穴）**：判定根拠はスナップショット（jsonb）に保存され、詳細画面は `parseMatchedPatterns`（`matchedPatterns.ts`）経由で読み戻す。現状この関数は `pattern/label/evidence/caveat` しかコピーしないため、**追加した `status` を読み戻しで捨ててしまう**。`parseMatchedPatterns` と `isMatchedPattern` を `status` を通すよう改修する（タスク追加）。改修しないと、保存済みレコメンドを表示する画面で「容量確認待ち」と「確定提案」を区別できない。

### 6.3 P3 ブランチの分岐（擬似コード）

```
P3（安いプランがある）の判定中：
  cheaperPlan が無ければ → P3 非該当（従来どおり）
  usageType !== "capacity" → 従来どおり P3 該当（status は付けない＝既定 confirmed 扱い）

  usageType === "capacity"（iCloud+）の場合だけゲート：
    ① 使用容量が無い（usedCapacityGb == null）
        → P3 該当・status="needs_capacity_check"
        → evidence="もっと安い下位プランがあります。使用容量を確認すると下げられるか判定できます"
    ② 使用容量あり・鮮度OK（daysSinceCapacityCheck ≤ capacityFreshnessDays）
        ├ smallestFittingPlan(used, 候補, cfg) が見つかる
        │   → P3 該当・status="confirmed"
        │   → cheaperPlan をその最小プランに差し替える（価格＝カタログ値・目安）
        │   → evidence="現在の使用容量なら ◯◯（◯GB）で足ります"
        └ 見つからない → P3 非該当（ダウングレードは提案しない）
    ③ 使用容量あり・鮮度切れ（しきい値超過）
        → P3 該当・status="needs_capacity_check"
        → evidence="前回確認時点では足りそうでした。今の使用容量を再確認しましょう"
```

### 6.4 Decision 決定への反映

```
determineDecision 内：
  P3 が該当していて status==="confirmed"        → consider_downgrade（従来）
  P3 が該当していて status==="needs_capacity_check" → review（断定しない）
  ※ P1/P2/P4 等が同時該当ならより強い Decision を優先（既存ルール不変）
```

---

## 7. recompute.ts の追加処理

```
buildRecommendationInput 内（iCloud+＝capacity のとき）：
  - usedCapacityGb / capacityCheckedAt を Subscription から取得
  - daysSinceCapacityCheck = 今日 - capacityCheckedAt（null 可）
  - cheaperPlanCandidates = 既存の知識ベース取得（matchedServiceId → ServicePlan、
      isFreeTier 除外・自分より安い）に capacityGb を載せた配列
      ※ 既存の cheaperPlan 抽出ロジックを再利用。価格・陳腐化補正はそのまま
  - 収まる最小プランの選択（smallestFittingPlan）と status 付与は
      computeRecommendation 側で行う（純関数に判定を寄せる）
```

非 capacity サブスクは従来どおり `cheaperPlan` を渡すだけ（`cheaperPlanCandidates` は空配列）。
第1段（重複クラウド発見）は **recompute 変更不要**。seed 済みの `cloud_storage` で既存 P2/P4 が既に動いている。

---

## 8. 文言の場所と正確性ガード

**文言の生成場所を訂正**：P3 の `evidence` 文字列は `reasons.ts` ではなく **`computeRecommendation.ts`（`matchPatternsP2toP6` 内の P3 分岐）** で組み立てている。`reasons.ts` は evidence を連結するだけ。したがって3段文言の実装は computeRecommendation.ts 側で行う。

P3(capacity) の `evidence` に織り込む（requirements §3）：
- 「データが消える」と書かない →「**同期・バックアップ・新規保存が止まる可能性があります。変更前に Apple の画面で確認してください**」
- 価格は確定額として断定しない（プラン名と容量を主、金額は「目安」）

**UI 側で付けるラベル**（数値は engine が返す `annualSavingsIfDowngraded` を表示する箇所）：
- 年換算は「**月額×12の目安**」と明示（iCloud+ は月額課金のみ。実在の年額プランに見せない）
- `status === "needs_capacity_check"` のときは節約額を**確定額として出さず**「容量確認後に判定」と添える

---

## 9. UI（just-in-time の容量入力）

- iCloud+ 詳細画面で、P3 が `needs_capacity_check` の時だけ「使用容量を確認」導線を出す（オンボーディングには出さない）
- 入力＝プラン容量（選択式：50/200/2,000…）＋使用容量（数値）。無料枠5GBは選択肢に出さない
- 保存時に `capacityCheckedAt` を更新
- OCR 自動入力は別スパイク（本ステアリング外）。手入力で完結する

---

## 10. 影響範囲まとめ

### 新規作成
| ファイル | 内容 |
|---|---|
| `apps/web/src/domain/capacity/fit.ts` | 「安全に収まる最小プラン」選択の純粋関数 |
| `apps/web/src/domain/capacity/fit.test.ts` | 上記の単体テスト |

### 変更
| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | `Subscription` に容量3フィールド／`ServicePlan` に `capacityGb`（いずれも任意）追加 |
| `config/scoring.ts` | 容量ゲート用しきい値3つ追加 |
| `computeRecommendation.ts` | 入力型拡張・MatchedPattern に status・P3 ゲート分岐・evidence 文言・Decision 反映 |
| `matchedPatterns.ts` | `parseMatchedPatterns`／`isMatchedPattern` を status 保持に改修 |
| `recompute.ts` | 容量フィールド／鮮度／容量つき候補プランを入力に詰める |
| `prisma/seed/service-catalog.json` | iCloud+ 各プランに `capacityGb` を付与（登録自体は既存・検証のみ） |
| iCloud+ 詳細 UI | just-in-time 容量入力・節約額「目安」ラベル・安全条件文言 |
| `computeRecommendation.test.ts` | 容量ゲートのテスト追加 |

### 変更しない
- P1〜P6 のロジック本体、Decision enum、判定パターン集合（新パターン不追加）
- クラウド各社のカタログ登録・代替関係（seed に既存）

---

## 11. テスト観点（design 段階で固定）

| 観点 | 期待 |
|---|---|
| 容量なし | P3 該当・`needs_capacity_check`・Decision=review |
| 鮮度OK＋収まる | P3 該当・`confirmed`・Decision=consider_downgrade |
| 鮮度OK＋収まらない | P3 非該当（提案しない） |
| 鮮度切れ | P3 該当・`needs_capacity_check`・Decision=review |
| 最下位プラン（下位なし） | P3 非該当 |
| しきい値差し替え | config 変更で境界が動く |
| 非 capacity サブスク | 従来どおり（status 既定 confirmed・ゲート無効） |
| 重複クラウド（第1段） | iCloud+ に P2/P4 が発火する |
