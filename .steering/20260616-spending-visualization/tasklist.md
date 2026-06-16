# tasklist.md — 支出の可視化

| # | タスク | 状態 |
|---|--------|------|
| 1 | 集計ドメイン純粋関数 `domain/spending/aggregate.ts` | ✅ 完了 |
| 2 | 単体テスト `aggregate.test.ts`（6件） | ✅ 完了 |
| 3 | API `GET /api/spending/summary` | ✅ 完了 |
| 4 | 仮UI `/spending` ページ | ✅ 完了 |
| 5 | ナビに「支出の可視化」追加（`layout.tsx`） | ✅ 完了 |
| 6 | 品質確認（lint / typecheck / vitest 全件） | ✅ 完了（74件パス・型/ lint exit 0） |
| 7 | 仮UI の実データ表示確認（合成データ） | ✅ 完了（`/spending` 描画確認） |

## 完了条件
- [x] 集計結果が実データ（合成）で正しく表示される。
- [x] テスト・型・lint がすべて通る。

## 残課題（別タスク）
- 仕上げのデザイン（UI 作り込みの仕切り直し後）。
- 請求履歴ベースの実支出推移（ポストMVP）。
- 出力の Zod スキーマ化（必要なら）。
