# requirements.md — 判定根拠（matchedPatterns）の DB 保存

> 作業ディレクトリ：`.steering/20260616-matched-patterns-persistence/`
> 着手日：2026-06-16
> 対象：`apps/web/`（バックエンド／ドメイン層が中心。確認用に詳細画面の最小仮表示まで）
> 背景：`.steering/20260615-web-ui-polish/`（UI 作り込みは仕切り直し）の要求C のうち、**データ層を先行実装**し、結果を見られるよう詳細画面に根拠タグを最小限だけ仮表示する。

## 1. 目的

SubBuddy がいま捨てている「判定の根拠」を保存し、画面に表示できるようにする。

### いまの動き

SubBuddy は、各サブスクに「続ける／見直す」の判定を出すとき、裏側で次の順に処理している。

1. 当てはまる条件をチェックする（例：「使っていない」「安い代替案がある」「更新が近い」）
2. 当てはまった条件を集めて、説明文を1本だけ作る（例：「最近使われていません。更新も近いです。」）
3. その説明文だけを保存し、集めた条件のリストは捨てる

この「条件のリスト」が **matchedPatterns**。レシートでいえば「合計だけのレシート」を残して「明細」を捨てている状態で、明細を保存していないため、画面に条件ごとの根拠タグ（「使っていない」等）を出せない。

### 「判定の根拠」の中身（具体データ）

matchedPatterns は「当てはまった根拠」だけを並べたリスト（当てはまらなければ0件）。
根拠1つは次の4項目を持つ（型は `domain/scoring/computeRecommendation.ts` の `MatchedPattern`）。

| 項目 | 内容 | 例 |
|---|---|---|
| `pattern` | どの根拠かの記号（P1〜P6） | `P1` |
| `label` | 短い見出し。**画面のタグになる文言** | `使っていない` |
| `evidence` | 根拠の具体的な説明文 | `最後に使ったのは45日前です。直近30日間の利用が0日です` |
| `caveat` | 注意書き（任意） | `背景再生は計測外です` |

根拠の種類（記号と画面タグ）：

| 記号 | label（タグ） | どんなときに当てはまるか |
|---|---|---|
| P1 | 使っていない | 能動利用（自分で操作して使う）サブスクが、一定期間使われていない（利用データが要る） |
| P2 | 重複で割高 | 同じカテゴリに、より安いサービスを契約している |
| P3 | 安いプランがある | 同じサービスに、いまより安いプランがある |
| P4 | 安い競合がある | より安い競合サービスがある |
| P5 | 更新が近い | 年額契約で、更新日が近い |
| P6 | 高額で長期継続 | 高額のまま、長い期間続いている |

> 説明文（`reason`）は、この matchedPatterns の `evidence`／`caveat` をつなげて作られる（`reasons.ts` の `buildReason`）。
> つまり matchedPatterns が「根拠の出どころ」で、reason はその表示用の文章にすぎない。

### この作業で変えること

捨てている明細（matchedPatterns）も、判定の記録（＝判定したときの内容をそのまま残す1件分のデータ。テーブル `recommendation_snapshots`）に一緒に保存する。これにより：

- 詳細画面に「使っていない」「更新が近い」などの根拠タグを表示できる（保存しなければ表示できない）。
- 判定バッジ・説明文・根拠タグを同じ1件の記録から読むので、判定したときの内容のまま、互いに食い違わずに表示できる。

## 2. なぜ「DB 保存」方式か（再計算方式を採らない理由）

- `reason` は元々 `buildReason(matchedPatterns)`（`src/domain/scoring/reasons.ts`）で導出されており、**根拠（matchedPatterns）こそが真の出典**。説明文だけ保存して根拠を捨てるのは不整合。
- 判定バッジ（`decision`）と根拠を**同じ1件の記録**から読めるようにすることで、判定時と表示時のズレ（バッジと根拠の食い違い）を防ぐ。
- 詳細画面で都度 `computeRecommendation` を呼び直す再計算方式は、入力（利用量・代替プラン等）を再構築するオーケストレーションロジックの重複を生む。

> 新しいテーブルや別の保存先は作らない。**既存の `recommendation_snapshots` に項目（列）を1つ追加するだけ**。

## 3. スコープ

### やること
- `RecommendationSnapshot`（Prisma `prisma/schema.prisma`）に `matchedPatterns` を保存する**項目を1つ追加**（型は後述の設計で確定。`Json` 列を想定）。
- Prisma マイグレーションを作成・適用。
- 判定保存処理（`src/repositories/recommendations.ts` の `appendRecommendationSnapshot`）で `result.matchedPatterns` を保存する。
- 取得側（`listLatestRecommendations` 等、`src/lib/queries.ts` を含む）で `matchedPatterns` を読み出せるようにする。
- 既存スナップショット（`matchedPatterns` 未保存の古いデータ）でも壊れない後方互換（null/空配列として扱う）。
- 単体テスト（vitest）：保存→取得で `matchedPatterns` が往復すること、後方互換、`reason` と整合すること。
- seed（`prisma/seed`）が新カラムでも通ること（合成データのみ）。
- **詳細画面に根拠ラベルの最小仮表示**：`subscriptions/[id]` のレコメンド欄に、保存した根拠（label）を既存スタイルの小さなタグで表示（動作確認優先・仕上げは後日）。観測中・根拠なしは出さない。

### やらないこと（今回スコープ外）
- 一覧・レコメンド画面など**詳細画面以外への根拠ラベル展開**、および根拠ラベルの**デザイン作り込み**（UI 作り込みの仕切り直し後に別途）。
- 判定ロジック（P1〜P7）の内容変更。`matchedPatterns` の中身（pattern/label/evidence/caveat）の仕様変更はしない。
- E2E の大幅追加（詳細画面の表示追加にとどめ、必要なら最小限のみ）。

## 4. 受け入れ条件

- [ ] `recommendation_snapshots` に `matchedPatterns` を保持する列が追加され、マイグレーションが適用できる。
- [ ] `appendRecommendationSnapshot` が `result.matchedPatterns` を保存する。
- [ ] 取得クエリで `matchedPatterns` が読み出せ、保存した内容と一致する（往復テスト green）。
- [ ] 旧データ（列が無い時期に作られた行 / null）でも例外なく扱える（後方互換テスト green）。
- [ ] `reason` と `matchedPatterns` が同一スナップショット内で整合する（`buildReason(matchedPatterns)` ≒ 保存済み reason）。
- [ ] 詳細画面で、保存した根拠ラベルがタグとして仮表示される（観測中・根拠なしは出ない）。
- [ ] `lint` / `typecheck` / `test`（vitest）が通る。詳細画面の表示追加にとどめ、既存 E2E が通ること。
- [ ] `docs/functional-design.md` の `RecommendationSnapshot` データモデルに新項目を追記（軽微）。

## 5. `docs/` への影響

- `docs/functional-design.md` のデータモデル（`RecommendationSnapshot` 定義）に `matchedPatterns` 項目を**1行追記**。基本設計の方針転換ではなく、既存テーブルへの項目追加レベル。
- PRD・他 docs への影響なし。

## 6. 制約・前提

- **PII・機微データ方針**：実在データを使わない。テスト・seed は合成データのみ。`matchedPatterns` は支出額等の生 PII を含めない（pattern/label/evidence の説明文のみ）。
- **作業範囲**：`apps/web/` 内に閉じる。`spikes/`・`.gitignore`・`devcontainer.json`・`obsidian/` 等の別セッション作業には触れない。
- **DB 起動**：PostgreSQL は手動起動が必要（dev 環境のクセ）。マイグレーション適用時に留意。
- **ブランチ／コミット**：本作業は専用ブランチ（例 `feat/matched-patterns-persistence`）で行う想定。コミットはユーザーが明示依頼したときのみ。
