# tasklist.md — 判定根拠（matchedPatterns）の DB 保存

> 対象：`apps/web/`。`requirements.md` / `design.md`（承認済み）に対応。

| # | タスク | 対応 | 状態 |
|---|--------|------|------|
| 1 | `MatchedPattern` を `interface` → `type` に変更（Json 保存の型適合） | design §2.1 | ✅ |
| 2 | `schema.prisma` の `RecommendationSnapshot` に `matchedPatterns Json?` を追加 | design §1 | ✅ |
| 3 | マイグレーション作成・適用（`20260616111925_add_matched_patterns`） | design §1 | ✅ |
| 4 | `appendRecommendationSnapshot` に `matchedPatterns` 保存を追加 | design §2 | ✅ |
| 5 | `parseMatchedPatterns()` ヘルパ新設（`domain/scoring/matchedPatterns.ts`） | design §3 | ✅ |
| 6 | 詳細画面に根拠タグの仮表示（空配列のときのみ非表示） | design §4 | ✅ |
| 7 | 単体テスト：往復・後方互換・不正要素除外・整合（ready 限定）＝5件 | design §5 | ✅ |
| 8 | `docs/functional-design.md` のデータモデルに `matchedPatterns` を追記 | design §6 | ✅ |
| 9 | 品質確認（lint(src) / typecheck / vitest 73件 すべて green） | design §7 | ✅ |
| 10 | 動作確認：再計算 → 詳細画面で根拠タグ表示（Netflix で確認） | design §7 | ✅ |

## 完了条件
- [ ] スナップショットに `matchedPatterns` が保存・取得でき、後方互換が保てる。
- [ ] 詳細画面に根拠タグが判定時の内容のまま表示される（空のときは出ない）。
- [ ] lint / typecheck / vitest がすべて通る。

## 制約
- 判定ロジック（P1〜P6）・根拠の中身仕様は変更しない。
- 合成データのみ。`apps/web` 内に閉じる。PostgreSQL は手動起動。
