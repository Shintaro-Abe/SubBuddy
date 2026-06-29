---
name: slide-deck-dojo-workstream
description: 道場中間発表スライド作業（spec駆動＋Napkin MCP＋Google Slides MCP）の確定方針。認証整備が前段、Napkin APIはセルフサービス（申請不要）
metadata: 
  node_type: memory
  type: project
  originSessionId: 83e49d17-d80e-4c39-a5e8-dbda442104fe
---

道場勉強会の10分中間発表スライドを作る作業。作業一式＝**プロジェクト直下 `slides/`**（requirements/design/tasklist/review-pack/setup/spec）。当初 `.steering/20260627-slide-deck-dojo/` だったが、隠しディレクトリでアップロード選択に出ないため `slides/` に移動（2026-06-27）。

**確定方針（2026-06-27 グリルで決定）:**
- ツール役割: AWSの spec駆動プレゼン手法（briefing→outline→art-direction→生成）を**プロセスとして借用**。デッキ本体は **Google Slides MCP（`ryanvo162/google-slides-mcp`・39ツール・自前ホスト・Google直）** で直接構築。図版は **Napkin AI MCP（`louischancly/napkin-ai-mcp`・非公式・npx）** で部品生成し埋め込む。pptx変換は使わない。
- コンテンツ源: `talk-draft-ai-coding-dojo.md`（9枚）を下敷きに briefing/outline 再設計。
- デザイン: [[web-ui-design-direction]] の Serene Capital（静謐なエディトリアル）に統一。16:9・日本語。
- 作業順序: 認証取得が先。本セッションは手順書化（T-1,T-2）まで完了。コンテンツ生成（spec/図版/デッキ）は認証後。

**重要な訂正:** 「Napkin API は申請メール必須・承認待ち」は**誤り**（非公式MCPのREADME/mcpservers.org が古い）。公式（help.napkin.ai / api.napkin.ai）ではセルフサービス発行＝`app.napkin.ai`→Account Settings→**Developersタブ**→Create API token。API 問い合わせ窓口は申請先ではない。無料は透かしあり→**有料プラン採用**。クレジット従量制。

**認証メモ:** Slides MCP は npx不可・`npm install && npm run build`→`node dist/index.js auth` で token（`~/.config/google-slides-mcp/token.json`）。OAuthはDesktop app種別、Slides+Drive API有効化。Napkin MCP は env `NAPKIN_API_KEY` のみ必須。OAuthトークン/APIキー/credentials.json は全てコミット禁止。
