# Google Slides MCP 導入手順（ryanvo162）

> Google スライドを AI（MCP）から直接作れるようにする手順書。所要 20〜30分。
> 必要なもの：Google アカウント、Node.js 18以上。
> MCP（＝AIが外部ツールを操作する仕組み）の `ryanvo162/google-slides-mcp` を、自分のPCで動かして使う。

## 前提

- ブラウザ操作（Google Cloud の設定）は**あなた自身**が行う。
- コマンド実行（クローン・ビルド・登録）は Claude が代行できる。
- マネージド型（Composio 等）は使わない。スライド内容が第三者を経由しないよう、自分のPCで動かす（Google と直接）。

## 手順

### ステップ1：MCP をダウンロードしてビルドする

AI から呼び出すプログラム本体を用意する。

```bash
git clone https://github.com/ryanvo162/google-slides-mcp.git && cd google-slides-mcp && npm install && npm run build
```

> ⚠ 置き場所は SubBuddy リポジトリの**外**にする（ビルド成果物や依存をうっかりコミットしないため）。

> ✅ 確認：`dist/index.js` ができていれば成功。

### ステップ2：Google Cloud でプロジェクトを作る

スライドを操作する権限の入れ物を作る。

1. [Google Cloud Console](https://console.cloud.google.com/) を開く。
2. 画面上部のプロジェクト選択 →「新しいプロジェクト」→ 名前を付けて作成。
3. 作ったプロジェクトを選択した状態にする。

> ✅ 確認：画面上部に作ったプロジェクト名が表示されている。

### ステップ3：必要な API を2つ有効にする

スライドとファイル操作の機能をオンにする。

1. 左メニュー →「API とサービス」→「ライブラリ」を開く。
2. 「Google Slides API」を検索 →「有効にする」。
3. 同じく「Google Drive API」を検索 →「有効にする」。

> ⚠ Drive API も必要（サムネイル・エクスポート・ファイル操作で使う）。Slides だけだと一部が動かない。

> ✅ 確認：両方とも「有効」になっている。

### ステップ4：OAuth 同意画面を設定する

自分のアカウントで認可できるようにする。

1. 「API とサービス」→「OAuth 同意画面」を開く。
2. User Type は「外部」を選んで作成。
3. アプリ名・サポートメール・デベロッパー連絡先を入力して保存。
4. 「テストユーザー」に**自分の Google アカウント**を追加する。

> ⚠ テストユーザーに自分を入れ忘れると、後の認可で弾かれる。

### ステップ5：OAuth クライアントを作って鍵をダウンロードする

ログイン情報（クレデンシャル）を発行する。

1. 「API とサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」。
2. アプリの種類は「**デスクトップアプリ**」を選ぶ。
3. 作成後、「JSON をダウンロード」して `credentials.json` を保存する。

> ⚠ 種類は必ず「デスクトップアプリ」。「ウェブアプリ」を選ぶと手順が合わなくなる。

> ⚠ `credentials.json` は秘密情報。リポジトリにコミットしない（リポジトリ外に置く）。

### ステップ6：ブラウザで認可してトークンを取る

PCのMCPに「このアカウントを使ってよい」と許可を与える。

```bash
node dist/index.js auth
```

1. ブラウザが開くので、対象の Google アカウントでログイン。
2. 「許可」を押す。

> ⚠ このコマンドはブラウザ認可を挟むので、他のコマンドと連結しない（単独で実行）。

> ✅ 確認：`~/.config/google-slides-mcp/token.json` が作られていれば成功。

### ステップ7：MCP を登録する

SubBuddy の `.mcp.json` に追記する（パスは手順1で置いた絶対パスに置き換える）。

```json
{
  "mcpServers": {
    "google-slides": {
      "command": "node",
      "args": ["/絶対パス/google-slides-mcp/dist/index.js"]
    }
  }
}
```

> ✅ 確認：MCP を読み直すと `google-slides` が認識される。

### ステップ8：動作確認する

実際に呼べるか試す。

- `createPresentation` でテスト用のデッキを1つ作り、確認できたら消す。
- 使える代表ツール：`createPresentation` / `addSlide` / `insertTextBox` / `insertImage` / `insertTable` / `updateText` / `exportPresentation`（PDF/PPTX/ODP）/ `getThumbnail`。

## 困ったとき

- 認可で弾かれる → ステップ4のテストユーザーに自分が入っているか確認。
- トークン期限切れ → もう一度 `node dist/index.js auth` を実行（同意画面が「テスト」だと期限が付くことがある）。
- `dist/index.js` が無い → ステップ1の `npm run build` が成功しているか確認。
