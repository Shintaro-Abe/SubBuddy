# requirements.md — 支出の可視化（集計層＋仮UI）

> 作業ディレクトリ：`.steering/20260616-spending-visualization/`
> 着手日：2026-06-16 ／ 対象：`apps/web/`
> 背景：戦略再定義で「支出の可視化」を見直し判断の中核材料に位置づけ直した（`research/20260606-recommendation-axes-strategy/`）。
> このステアリングは、作業会で実装した内容の記録（実装後に整理）。

## 1. 目的

継続中のサブスク契約から、支出を複数の切り口で集計して見えるようにする。
従来はダッシュボード画面の中で「現時点の月額/年額合計」をその場で足し算していただけで、推移や内訳が見えなかった。
これを画面から切り離した**再利用できる集計のしくみ**と、その結果を返す**API**、確認用の**仮UI**として用意する。

## 2. スコープ

### やったこと
- 集計ドメイン層（純粋関数）：月額合計・年額見込み・カテゴリ別内訳（構成比）・月次推移。
- API：`GET /api/spending/summary`。
- 仮UI：`/spending` ページ（動作確認優先・既存 zinc スタイル・簡易バー）＋ナビ追加。
- 単体テスト（vitest）。

### やらないこと
- 仕上げのデザイン（仕切り直し中の UI 作り込みで対応）。
- 請求履歴（BillingEvent）に基づく実支出推移（今回は登録日ベースの積み上がりで近似）。

## 3. 受け入れ条件

- [x] 月額合計・年額見込み・カテゴリ別内訳・月次推移を集計できる。
- [x] active 以外（paused/canceled）は集計対象外。
- [x] 集計は純粋関数（`referenceDate` 注入）で、`Date.now()` に依存しない＝テスト可能。
- [x] `GET /api/spending/summary` が JSON を返す。
- [x] `/spending` で実データ（合成）を表示できる。
- [x] `lint` / `typecheck` / `test`（vitest）が通る。

## 4. 制約・前提

- PII・機微データ方針：合成データのみ。集計値に生 PII を含めない。
- 作業範囲：`apps/web/` 内。`spikes/`・`.gitignore`・`devcontainer.json`・`obsidian/` 等の別セッション作業には触れない。
- PostgreSQL は手動起動（dev 環境のクセ）。
