# タスクリスト：Gemini 汎用相談スキル（OAuth 限定）

design.md（承認済み）に基づく実装タスク。**API キー経路は持たない。**

## 完了済み（先行作業）
- [x] 実現手段の確認（`@google/gemini-cli` v0.45.2 / Node 24 / 無料 OAuth 枠）
- [x] 方向性のユーザー確認（形態=Skill・接続=OAuthのみ・スコープ=汎用相談・出力=任意保存）
- [x] gemini CLI グローバル導入＆フラグ検証（-p / --approval-mode plan / --skip-trust / -m / -o）
- [x] 認証挙動の実機検証（`! gemini` は非対話TTYで OAuth 不可 → 案内のみ）
- [x] ステアリング起票（requirements → design → tasklist。1ファイルずつ承認）

## 実装（design 承認後に着手）
- [x] **T1** helper 改修：API キー経路を除去
  - `~/.gemini/.env` ロード処理を削除
  - 認証チェックを OAuth 限定に（`oauth_creds.json` / `settings.json:selectedAuthType` のみ）
  - 未設定メッセージを「VS Code 統合ターミナルで `gemini` ログイン」一本に統一
- [x] **T2** SKILL.md 改修：§6 縮退の認証案内を OAuth 限定に統一（API キー記述を削除）
- [x] **T3** 静的検証：`bash -n` 通過／認証未設定で exit 3・正しい案内が出る
- [x] **T4** スキル登録確認：利用可能スキル一覧に `gemini` が出る

## ユーザー操作（実装後）
- [x] **U1** VS Code 統合ターミナルで `gemini` を対話起動し "Login with Google" でログイン（oauth_creds.json 生成確認）
- [x] **U2** スモークテスト成功：research モードで出典URL付き回答を確認（Next.js / Playwright の2問）。
      研究テンプレに「末尾に番号付き出典URL一覧を必ず列挙」を追記して URL 明示を担保。
      ※ `[IDEClient] Failed to connect` / `Invalid stream`（末尾）/ 稀な `</code>` は exit=0 の無害ノイズ。

## 完了条件
- `/gemini <問い>` が OAuth 認証下で出典付き回答を返す。
- 認証未設定時はハングせず OAuth 手順を案内して停止する。
- helper/SKILL に API キー関連の記述・処理が残っていない。
- Gemini にリポジトリの実データ／コードを暗黙に渡していない（隔離 cwd・読み取り専用）。
