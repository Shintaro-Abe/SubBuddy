# design.md — 判定根拠（matchedPatterns）の DB 保存

> 対象：`apps/web/`。`requirements.md`（同ディレクトリ・承認済み）に対応。
> 方針：既存テーブル `recommendation_snapshots` に項目を1つ追加するだけ。新テーブル・別保存先は作らない。

## 1. データモデル変更

`prisma/schema.prisma` の `RecommendationSnapshot` に1列追加：

```prisma
matchedPatterns Json? @map("matched_patterns") // 判定根拠（MatchedPattern[]）。観測中や旧データは null
```

- 型は `Json?`（PostgreSQL `jsonb`）。中身は `MatchedPattern[]`（`domain/scoring/computeRecommendation.ts` の型）。
- `Json?`（nullable）にすることで、列が無い時期に作られた**既存行は null** となり後方互換が保てる。
- マイグレーション：`npx prisma migrate dev --name add_matched_patterns`（PostgreSQL 手動起動が前提）。

## 2. 保存（書き込み）

`src/repositories/recommendations.ts` の `appendRecommendationSnapshot` の `create.data` に追加：

```ts
matchedPatterns: result.matchedPatterns, // MatchedPattern[] を jsonb へ
```

- 呼び出し元は `services/recompute.ts` の1か所のみ（`result` に `matchedPatterns` を含む）。呼び出し側の変更は不要。

### 2.1 型の前提（重要）

`MatchedPattern` は現在 **`interface`**（`computeRecommendation.ts:31`）で宣言されている。TypeScript は `interface` に暗黙の索引シグネチャを付けないため、Prisma の Json 入力型 `InputJsonValue`（索引シグネチャ型 `InputJsonObject`。`@prisma/client/runtime/library.d.ts:1856`）に**そのままでは代入できず型エラーになる**。

対応（推奨順）：

1. **`MatchedPattern` を `interface` → `type` エイリアスに変更**する。`type` には暗黙の索引シグネチャが付き、`InputJsonObject` が `?`（undefined 許容）のため `caveat?` も適合 → **キャスト不要・型安全**のまま保存できる。既存利用箇所（reasons.ts 等）は型名のみ参照のため影響なし。
2. （次善）保存時に `result.matchedPatterns as unknown as Prisma.InputJsonValue` でキャストする（型安全性は少し下がる）。

本設計は **1（interface→type）** を採る。

## 3. 取得（読み出し）と後方互換

Prisma は `jsonb` を `JsonValue` として返すため、`MatchedPattern[]` へ安全に復元するヘルパを追加する。

- 置き場所：`src/domain/scoring/matchedPatterns.ts`（新規）
- 関数：`parseMatchedPatterns(value: unknown): MatchedPattern[]`
  - null / 未定義 / 配列でない → `[]`（後方互換）。
  - 配列なら、各要素が `pattern`(string) と `label`(string) と `evidence`(string) を持つものだけ通す軽い型ガード（壊れたデータでも例外を投げず、不正要素は除外）。
- 既存の取得関数（`listLatestRecommendations` 等）は Prisma 型に `matchedPatterns` が自動で乗るため変更不要。読み出し側でこのヘルパを通す。

## 4. 仮 UI（詳細画面・最小）

- 対象：`src/app/(dashboard)/subscriptions/[id]/page.tsx` のレコメンド欄。
- 既存の `reason` テキストの**近く**に、`parseMatchedPatterns(rec.matchedPatterns)` の各 `label` を**既存スタイルの小さなタグ**で並べる（zinc ベース。新しい色・装飾は足さない）。
- **表示条件は `matchedPatterns.length === 0` のときだけ非表示**にする（`dataStatus` では切らない）。
  - 理由：観測中（`observing`）でも P2〜P6 は判定され `matchedPatterns` に入り、reason 文にも既に根拠が出る（`computeRecommendation.ts:122,126-127`）。`observing` でタグを隠すと「説明文には根拠があるのにタグが無い」食い違いになる。空配列のときだけ隠せば、観測中で根拠なしの場合も自然に出ない。
- 一覧・レコメンド画面への展開、デザイン作り込みはしない（スコープ外）。

## 5. テスト（vitest）

- `src/domain/scoring/matchedPatterns.test.ts`
  - 往復：`MatchedPattern[]` を `parseMatchedPatterns` に通すと同じ内容が返る。
  - 後方互換：`null` / 非配列（文字列・オブジェクト）→ `[]`。
  - 不正要素の除外：必須キー欠落の要素は落とし、正しい要素だけ残す。例外を投げない。
- 整合（**`dataStatus === "ready"` のスナップショットに限定**）：保存した `matchedPatterns` から `buildReason` を再生成すると、保存済み `reason` に一致する。
  - 注：観測中で根拠なしのとき reason は `reasonObserving(...)`（`computeRecommendation.ts:128`）で `buildReason([])` と一致しないため、ready に限定する。ready は常に reason = `buildReason(patterns)`（line 151）。

## 6. 影響範囲・非対象

- 追加：`domain/scoring/matchedPatterns.ts` ＋テスト、Prisma マイグレーション1件。
- 変更：`schema.prisma`（1列）、`computeRecommendation.ts`（`MatchedPattern` を interface→type）、`repositories/recommendations.ts`（1行）、`subscriptions/[id]/page.tsx`（仮表示）。
- ドキュメント：`docs/functional-design.md` の `RecommendationSnapshot` データモデルに `matchedPatterns` を1行追記。
- 判定ロジック（P1〜P6）・`matchedPatterns` の中身仕様は**変更しない**。

## 7. 検証手順

1. `npx prisma migrate dev` 適用 → `npm run db:seed`（合成データ）。
2. ダッシュボードの「判定を再計算」を実行 → スナップショットに `matchedPatterns` が保存される。
3. 詳細画面で根拠タグが表示される（観測中は出ない）ことを確認（スクショ）。
4. `lint` / `typecheck` / `test`（vitest）green。既存 E2E が通ること。
