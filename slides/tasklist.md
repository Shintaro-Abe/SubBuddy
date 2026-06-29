# タスクリスト — 道場中間発表スライド（spec駆動＋Napkin＋Google Slides）

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | Google Slides MCP（ryanvo162）導入手順書を作成 | AC-2 | 完了 | `setup/setup-google-slides-mcp.md` がGCP OAuth〜ビルド〜登録まで網羅 |
| T-2 | Napkin AI MCP 導入手順書を作成 | AC-4 | 完了 | `setup/setup-napkin-mcp.md` が有料プラン〜トークン〜登録まで網羅 |
| T-3 | ユーザー手作業：GCPプロジェクト作成・Slides/Drive API有効化・OAuthクライアント・auth認可 | AC-2 | 完了 | `token.json` 取得済み・`listPresentations` 成功 |
| T-4 | Slides MCP をビルドし `.mcp.json` 登録・疎通 | AC-1 | 完了 | `/home/vscode/google-slides-mcp` ビルド済み・登録済み・疎通OK |
| T-5 | ユーザー手作業：Napkin 有料プラン契約・Developersタブでトークン発行 | AC-4 | 完了 | トークン発行済み・環境変数 `NAPKIN_API_KEY` 設定済み |
| T-6 | Napkin MCP を `.mcp.json` 登録・疎通 | AC-3 | 完了 | `${NAPKIN_API_KEY}` 参照で登録・`verify_api_key` 成功（再起動後検証済み） |
| T-7 | briefing 再定義（聞き手・伝えたいこと・どうなってほしいか） | AC-5 | 完了 | `spec/briefing.md` 作成 |
| T-8 | outline 再設計（1スライド1メッセージ・9枚） | AC-5 | 完了 | `spec/outline.md` 作成、talk-draftと整合 |
| T-9 | art-direction 定義（DESIGN.md由来） | AC-6 | 完了 | `spec/art-direction.md` 作成、色/フォント/トーン整合 |
| T-10 | slide-spec 起こし（各スライド確定原稿＋図版指定） | AC-5, AC-7 | 完了 | `spec/slide-spec.md` 作成 |
| T-11 | Napkin で図版生成（該当スライド分）→ `./visuals` 保存 | AC-7 | 未着手 | 図版がアートディレクションに沿って生成済み |
| T-12 | Slides MCP でデッキ生成＋図版埋め込み | AC-7 | 未着手 | Google Slides に9枚デッキ完成 |

状態: 未着手 / 進行中 / 完了 / 保留

> 本セッションは T-1・T-2 まで（steering一式＋2手順書）。T-3〜T-6 はユーザー手作業を含む認証整備、T-7〜T-12 は認証完了後のコンテンツ生成。

## 実装中の逸脱ログ

- グリル中の重大訂正: 「Napkin API = 申請メール必須・承認待ち」は誤り（非公式MCPのREADMEが古い）。公式はセルフサービス発行（Developersタブ）。→ Napkin を保留から通常スコープに戻し、申請メール文面の作成を取りやめ、トークン発行手順に差し替え。再承認: 不要（ユーザー確認済み）。

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [ ] スライド・spec・図版に実データ／PIIが無いことを確認
- [ ] 秘密情報（OAuthトークン・APIキー）が未コミットであることを確認
