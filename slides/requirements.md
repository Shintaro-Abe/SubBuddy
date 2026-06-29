# 要求内容 — 道場中間発表スライド（spec駆動＋Napkin＋Google Slides）

## 背景・目的

AIコーディング道場の勉強会で、SubBuddy を題材に10分の中間発表を行う。原稿は `talk-draft-ai-coding-dojo.md`（9枚構成）に出来上がっている。これを実際の登壇スライド（Google Slides）に仕立てる。

作り方は AWS の spec駆動プレゼン手法（ブリーフィング→アウトライン→アートディレクション→生成）を**プロセスとして借用**し、スライド本体は Google Slides MCP で直接構築、図版は Napkin AI で生成して埋め込む。ツール導入が前提になるため、認証・MCP整備を先に固める。

## 変更・追加する機能の説明

- やること:
  - AWS手法をプロセスとして borrowing し、`talk-draft` を下敷きに briefing/outline を再設計、art-direction を定義、slide-spec を起こす。
  - Google Slides MCP（ryanvo162・39ツール／自前ホスト）を導入し、デッキ本体を直接構築する土台を整える。
  - Napkin AI MCP（louischancly・非公式）を導入し、図版（部品）を生成してスライドに埋め込む土台を整える。
  - 上記のための認証取得・MCP導入手順書を用意する。
- やらないこと:
  - アプリ本体（`apps/web` 等）のコード変更。
  - `docs/`（基本設計）の変更。
  - AWS のサンプルアプリ自体のデプロイ（手法のみ借用。pptx 出力経路は使わない）。
  - 実データ・PII のスライド掲載（合成・公開可能な内容のみ）。

## ユーザーストーリー

- 登壇者として、原稿を読みやすい登壇スライドに落としたい。なぜなら中間発表で「動くもの」と「詰まった所」を10分で正直に共有したいから。
- 登壇者として、図版とスライドを AI（MCP）で組み立てたい。なぜなら手作業のレイアウトに時間を取られず内容に集中したいから。
- 登壇者として、アプリと同じ静謐なエディトリアルのトーンで見せたい。なぜならお金の判断支援という信頼トーンを資料でも保ちたいから。

## 受け入れ条件

- [ ] AC-1: Google Slides MCP（ryanvo162）がローカルでビルドされ、`.mcp.json` に登録され、`create_presentation` 等が呼べる状態になっている。
- [ ] AC-2: Google Slides MCP の認証（GCPプロジェクト／Slides API有効化／OAuthクライアント／refresh token）取得手順が、ユーザーが実行できる粒度で文書化されている。
- [ ] AC-3: Napkin AI MCP が `.mcp.json` に登録され、`verify_api_key` が成功する状態になっている。
- [ ] AC-4: Napkin の有料プラン契約＋トークン発行手順が、ユーザーが実行できる粒度で文書化されている（透かしなしの前提）。
- [ ] AC-5: briefing / outline / art-direction / slide-spec の spec一式が `spec/` に作成され、`talk-draft` の9枚構成と整合している。
- [ ] AC-6: art-direction が `DESIGN.md`（Serene Capital＝静謐なエディトリアル）と整合している（色・フォント・トーン）。
- [ ] AC-7: slide-spec に基づき Google Slides 上にデッキが生成され、Napkin 図版が該当スライドに埋め込まれている。

> 本セッションのスコープは AC-1〜AC-4 の「手順書化」と steering 一式の作成まで。AC-5〜AC-7 は認証完了後に着手する（tasklist 参照）。

## 制約事項

- PII・機微データ方針: 実データ・実契約・実利用ログ・メールアドレス等をスライドに載せない。例示は合成データのみ。
- ローカルファースト: Slides MCP は自前ホスト（Google直、第三者サービス経由なし）を採用。
- しきい値・設定値の外出し: スライドに記載する判定しきい値（7日・¥2,000・12ヶ月）は実装と一致させ、原稿の値を正とする。
- デザイン: `DESIGN.md` の Serene Capital を唯一の源とする。煽り表現・派手なギミックを入れない（中立・相棒トーン）。
- 外部依存: Napkin API は "developer preview" 表記（破壊的変更の可能性あり）。Napkin MCP・Slides MCP はともに非公式/OSS。
