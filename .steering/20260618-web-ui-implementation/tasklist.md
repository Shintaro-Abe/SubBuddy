# タスクリスト：Web UI 実装（全画面を新デザインへ）

## フェーズA：土台（直列・本体担当）
- [x] A1. `app/layout.tsx`：next/font 5種導入＋`<html lang="ja">` に変数付与（BIZ UDPGothic は 400/700）
- [x] A2. `app/globals.css`：design.css のトークン＋4段スケール＋全部品クラスを移植（フォントは next/font 変数へ／ダークモード削除／表は `.ds-table` にスコープ）
- [x] A3. `components/SidebarNav.tsx`（新規・client）：丸ドットナビ＋現在地ハイライト
- [x] A4. `(dashboard)/layout.tsx`：サイドバーシェル化（ブランド＋SidebarNav＋登録ボタン）
- [x] A5. 共有部品 restyle：`components/DecisionBadge.tsx`／`lib/display.ts`（`DECISION_DOT_CLASS`）／`components/RecomputeButton.tsx`

## フェーズB：ページ移植（並列・サブエージェント）
- [x] B1. ダッシュボード `(dashboard)/page.tsx`
- [x] B2. サブスク一覧 `subscriptions/page.tsx` ＋ `components/SubscriptionCard.tsx`
- [x] B3. サブスク詳細 `subscriptions/[id]/page.tsx`（＋`DeleteSubscriptionButton`/`ShortcutsQrCode`）
- [x] B4. 登録/編集フォーム `subscriptions/new`・`[id]/edit` ＋ `SubscriptionForm`/`ServiceCatalogSearch`
- [x] B5. 支出の内訳 `spending/page.tsx`
- [x] B6. レコメンド `recommendations/page.tsx`
- [x] B7. 更新間近 `renewals/page.tsx`

## フェーズC：検証・仕上げ（本体担当）
- [x] C1. `npx eslint src` グリーン
- [x] C2. `npx tsc --noEmit` グリーン
- [x] C3. `npx vitest run` グリーン（12ファイル/79件）
- [x] C4. `npx next build` 成功＋全6画面スクショで視覚確認
- [ ] C5. コミット（ユーザー明示時）／必要なら PR ← 未（要指示）
- [ ] C6.（余れば）DESIGN.md を design.css に合わせ整流 ← 未

## 残課題（次回）
- カテゴリ表示が英語キー（video / ai / music 等）。DESIGN.md §7 は日本語表記 → 表示マッピングはデータ/内容課題のため別途。
- 他画面の細部詰め（モックとの微差・モバイル下部タブ）。

## 完了条件
- 全 `(dashboard)` 画面が新デザインで表示され、旧 zinc 配色が残らない。
- 機能・データ・導線は従来通り。判定色マッピング順守。警告赤は strong_cancel のドットのみ。
- eslint/型/vitest グリーン。
