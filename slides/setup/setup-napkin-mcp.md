# Napkin AI MCP 導入手順（louischancly）

> テキストから図版（フロー図・概念図など）を AI で作れるようにする手順書。所要 10〜15分。
> 必要なもの：Napkin AI アカウント（有料プラン）、Node.js 18以上。
> MCP（＝AIが外部ツールを操作する仕組み）の `louischancly/napkin-ai-mcp`（非公式）を使う。図版の「部品」を作る用途で、スライド全体は作らない。

## 前提

- 有料プランの契約とトークン発行は**あなた自身**が行う（Napkin アカウント本人）。
- 登壇資料に使うため**最初から有料プラン**にする（無料プランは図版に透かしが入る）。
- 申請メールや承認待ちは不要（セルフサービスで発行できる）。

## 手順

### ステップ1：有料プランを契約する

透かしを消し、生成に使うクレジットを確保する。

1. [app.napkin.ai](https://app.napkin.ai) にログイン。
2. 有料プランを契約する。

> ⚠ 無料のままだと生成図版に透かし（watermark）が入る。登壇資料には不向き。

### ステップ2：API トークンを発行する

MCP が Napkin を呼ぶための鍵を作る。

1. アカウント設定（または Team Space 設定）を開く。
2. 「Developers」タブを開く。
3. 「Create new API token」を押す。
4. 表示されたトークンを安全に控える。

> ⚠ トークンは再表示できない場合がある。発行直後に控える。

> ⚠ トークンは秘密情報。リポジトリにコミットしない。

> ✅ 確認：Developers タブにトークンが1件できている。

### ステップ3：MCP を登録する

SubBuddy の `.mcp.json` に追記する（トークンは自分の値に置き換える）。

```json
{
  "mcpServers": {
    "napkin-ai": {
      "command": "npx",
      "args": ["-y", "napkin-ai-mcp"],
      "env": {
        "NAPKIN_API_KEY": "<発行したトークン>",
        "NAPKIN_STORAGE_TYPE": "local",
        "NAPKIN_STORAGE_LOCAL_DIR": "./visuals",
        "NAPKIN_DEFAULT_FORMAT": "svg",
        "NAPKIN_DEFAULT_LANGUAGE": "ja",
        "NAPKIN_DEFAULT_COLOR_MODE": "light"
      }
    }
  }
}
```

> ⚠ 必須は `NAPKIN_API_KEY` だけ。他は任意（保存先や既定の見た目）。

コマンドで追加する場合はこちら。

```bash
claude mcp add napkin-ai -- npx -y napkin-ai-mcp
```

> ⚠ コマンドで追加したときは、別途 `NAPKIN_API_KEY` を環境変数で設定する。

### ステップ4：動作確認する

鍵が有効か確かめる。

- MCP を読み直して `verify_api_key` を実行する。

> ✅ 確認：`verify_api_key` が成功すればOK。

## 困ったとき

- 図版に透かしが残る → 有料プランが有効か、正しいアカウントのトークンか確認。
- `verify_api_key` が失敗 → トークンの貼り間違い、または環境変数の設定漏れを確認。
- 図版生成が 429（回数制限） → プランのレート上限。少し待つか、バリエーション数を減らす。
