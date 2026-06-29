---
name: web-ui-design-direction
description: Web UI の目指す方向＝静謐なエディトリアル（Awwwards級のクラフトを信頼トーンで・煽らない・静的可）
metadata: 
  node_type: memory
  type: project
  originSessionId: 5259727f-c573-4f41-84f8-c43e7e35a88f
---

SubBuddy Web（`apps/web/`）の UI/UX 作り込みの目指す方向は「**静謐なエディトリアル**」。2026-06-15 にユーザーが3案（静謐なエディトリアル／大胆で表情豊か／親しみのある相棒）から選択。

**狙い:** Awwwards 受賞サイト（特に Shopify Editions / Scout Motors 寄り）の“クラフトの質と情緒”を借りて「感動を生む」UI にする。ただしレイアウトの真似ではなく、落ち着いた信頼トーンで実現する。

**具体の方向:**
- モノトーン＋深い1色アクセント（深緑インク想定）、たっぷりの余白、細い罫線。
- 金額を大きく静かな“主役数字”として見せる（Serif 見出し＋端正な Sans 本文）。
- 心が動く空状態（empty state）・上質なカード・強い情報階層を重視。

**制約（重要・優先）:** [[no-internal-codes-in-docs]] と [[writing-plain-japanese]] に加え、**派手なギミック・煽り表現は入れない**。「節約額を大げさに見せない・中立・相棒トーン」は維持。お金の判断支援アプリなので信頼を最優先。アニメーションは必須ではなく、静的な状態でも良い（ユーザー明言）。

**参考サイト（ユーザー提示・Awwwards 2025-2026）:** Lando Norris / Messenger(abeto) / Bruno Simon / Scout Motors / Shopify Editions / Ponpon Mania。

**確定（2026-06-17）:** デザインシステムは **リポジトリ直下 `DESIGN.md`** で管理（唯一の源・Stitch の design.md 形式と互換で往復同期可）。中身は Stitch「Subsc Calm Manager」のテーマ **Serene Capital**（セージ緑＋オフホワイト＋EB Garamond/Hanken Grotesk/Geist）をベースに、**MUJI（実用的な表・一覧性）×Aesop（編集的セリフ見出し・支出グラフ・深緑の見直しメモ/根拠カード）のハイブリッド**。判定色は赤を「強い解約候補」のみに限定しテラコッタで和らげる（煽らない）。Stitch 由来：project `5208444391091834087` / designSystem `assets/d279ff4260764fa0ae3eab0f80214c24` / 試作画面 `9aa30be4...`（`tmp/stitch-calm/hybrid-dashboard.*`）。実装時は EB Garamond + Hanken Grotesk を `next/font` で追加。

関連作業: `.steering/20260615-web-ui-polish/`（高優先3項目＝オンボーディング導線・入力エラーのリアルタイム表示・判定根拠パターン表示）。[[quantitative-recommendation-engine]] の判定結果を表示する画面群が対象。

**実装完了（2026-06-18）:** `apps/web` の**全画面を新デザインへ刷新**（サイドバー共通シェル＋7画面：ダッシュボード/一覧/詳細/登録編集/支出の内訳/レコメンド/更新間近）。データ取得は不変・見た目のみ移植。
- **実装の値の正(SSOT)＝`tmp/stitch-calm/design.css`**（全部品を網羅した完成版CSS・gitignore対象）。`globals.css` はこれを移植。`DESIGN.md` は design.css に整流済み（齟齬時は design.css 優先）。モック7画面＝`tmp/stitch-calm/*.html`。
- **フォント（next/font）**：Zen Kaku Gothic New（本文/見出し）／Shippori Mincho（大見出しの明朝のみ）／BIZ UDPGothic（数字 tabular）／EB Garamond（欧文）／Geist Mono。※当初メモの「Hanken Grotesk」は不採用、BIZ UDPGothic は400/700のみ。
- 判定バッジ＝ドット＋ラベル（`lib/display.ts` の `DECISION_DOT_CLASS`）。カテゴリ日本語化＝`categoryLabel`（表示のみ・データ不変）。中立トーン徹底（赤は強い解約候補ドットのみ）。
- 進め方：CLAUDE.md手順で `.steering/20260618-web-ui-implementation/`。土台は本体・各画面移植は並列サブエージェント。
- 出荷：ブランチ `feat/spending-and-design` → **PR #3**（分岐元都合で matched-patterns 永続化コミットも同梱）。残：他画面の細部詰め・モバイル下部タブ。
