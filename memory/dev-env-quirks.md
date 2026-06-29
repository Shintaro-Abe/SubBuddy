---
name: dev-env-quirks
description: SubBuddy ローカル開発環境の再発しやすい癖（DB起動・.next重複ファイル・gitleaks）
metadata: 
  node_type: memory
  type: project
  originSessionId: f7b6d02c-94a4-465d-8503-ae78d9fb4bdd
---

SubBuddy（`apps/web`）のローカル開発で繰り返し遭遇する環境固有の癖。コードからは読み取れない。

- **PostgreSQL はセッションごとに手動起動が必要**。自動起動しない。
  `sudo -n service postgresql start`（ダメなら `sudo -n bash -c "su postgres -c 'pg_ctlcluster 15 main start'"`）。
  DB は role `subbuddy` / DB `subbuddy_dev`、ポート 5432。`.env` の `DATABASE_URL` 参照。再構築は `scripts/setup-local-db.sh`。
- **`.next` 配下に名前末尾 " 2" の重複ファイル/ディレクトリが生成される**（FUSE/同期由来）。`rm -rf` も `mv` も ENOTEMPTY / "resource deadlock avoided" で失敗する。
  対処：① `tsconfig.json` の exclude に `**/* 2.*` を追加済み（typecheck 阻害回避）。② クリーンビルドは `mv .next .next.old.<ts>` で退避してから `npm run build`（`.next.broken` / `.next.old.*` は `.gitignore` 済み）。
- **`next dev`（Next 16・turbopack）でキャッシュ破損 panic が出る**：`Failed to restore task data (corrupted database or bug)` / `Unable to open static sorted file ... .sst (No such file or directory)`。dev サーバーが起動しない。
  対処：next プロセスを全 kill → `rm -rf .next ".next 2"` → 再起動。`.next` を握ったまま起動すると再生成で再発するので、kill 完了を確認してから削除する。
- **`npm run lint`（引数なし eslint）が `.next.old.*` 退避ディレクトリを走査して大量エラー**（529件等）になる。ソースは無実：`npx eslint src` は通る。`.gitleaks.toml` 同様 eslint の ignore も `.next` のみで退避名は外れる。
  対処：`rm -rf .next.old.*` で掃除してから `npm run lint`。lint の真偽は `npx eslint src` で確認するのが確実。
- **`gitleaks detect --no-git` は `.next*` を過剰スキャン**して build 成果物を誤検知する（`.gitleaks.toml` の allowlist は `.next/` のみで退避ディレクトリ名は外れる）。
  有効なゲートは **ソースに絞った** `gitleaks detect --no-git --config .gitleaks.toml --source apps/web/src`。コミット前は [[pii-policy]] 準拠でソース検出ゼロを確認する。
- Prisma は v7 の設定方式（driver adapter 必須）を避け **6.19.3 固定**。`url=env("DATABASE_URL")` の従来方式が使える。
- **eslint は react-hooks v6 の厳格ルール（`react-hooks/purity`・`react-hooks/set-state-in-effect`）が有効**。`Date.now()`/`Math.random()` 等を**コンポーネント描画や useMemo 内で呼ぶと purity 違反**、effect 内 setState も警告。対処：現在時刻依存の計算は描画層から出し、ユーティリティ関数（例 `lib/display.ts` の `daysSince`）かサーバコンポーネントで読んで **prop で渡す**（ハイドレーション一致も取れる）。typecheck が通っても `npx eslint src` で落ちるので、UI 変更時は両方回す。
- **Claude Code のターミナル出力をマウスでドラッグ選択→コピーすると日本語が文字化けする**（「æãããã»æ」=UTF-8をLatin-1で誤読した二重エンコード）。原因は Claude Code 本体のバグ：フルスクリーン描画がマウスをキャプチャし、選択を OSC 52 経由でクリップボードへ送る際に UTF-8 を取り違える。公式 issue [#42417](https://github.com/anthropics/claude-code/issues/42417) は not planned で**未修正**（2.1.167 でも残存）。貼り付け先は無実（クリップボードの中身が既に壊れている＝どこに貼っても化ける）。
  回避策：① **⌥ Option を押しながらドラッグで選択→⌘C**（マウスキャプチャをバイパスしVS Codeネイティブ選択＝正しいUTF-8）。効かなければ VS Code 設定 `macOptionClickForcesSelection` をON。② 確実版は出力をファイルに書き出して**エディタ画面でコピー**（描画を介さず100%化けない）。
  **恒久化**：`terminal.integrated.macOptionClickForcesSelection: true` は `.devcontainer/devcontainer.json` の `customizations.vscode.settings` に追記済み（コンテナ生成時に毎回適用＝reopen/rebuildでも消えない）。`~/.vscode-server/data/Machine/settings.json` への直書きは reopen では残るが **rebuild で再生成され消える**ので、devcontainer.json 側が正解。詳細ナレッジは [[obsidian/2026-06-07_terminal-japanese-copy-mojibake-osc52]]。
