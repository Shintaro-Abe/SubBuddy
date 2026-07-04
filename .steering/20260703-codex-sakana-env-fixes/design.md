# 設計 - Codex / Sakana Fugu 環境是正

## 実装アプローチ

軽量修正として、ワークスペース内で完結する 2 点を直す。

1. Sakana Fugu ローカルプロキシで `payload.model === "codex-auto-review"` を Sakana の実モデルへ差し替える。`~/.codex/config.toml` の `approvals_reviewer = "auto_review"` を消さずに使える状態を優先する。
2. DevContainer に `SAKANA_API_KEY` の環境変数引き継ぎと、bubblewrap/user namespace 用の `runArgs` を追加する。`--privileged` は避ける。
3. `dockerfile-memo.txt` のうち OS パッケージ導入部分だけを採用し、ローカル Dockerfile で `bubblewrap` などを入れる。Node / Codex / gitleaks は既存の `features` と `post_create.sh` に任せ、二重管理を避ける。

## 変更するコンポーネント

| コンポーネント / ファイル | 変更内容 | 対応する受け入れ条件 |
|---|---|---|
| `scripts/sakana-fugu-proxy.mjs` | `codex-auto-review` を `SAKANA_REVIEW_MODEL` / `SAKANA_MODEL` / 既定モデルへ差し替える | AC-1 |
| `.devcontainer/devcontainer.json` | `SAKANA_API_KEY` を `containerEnv` に追加 | AC-2 |
| `.devcontainer/devcontainer.json` | `seccomp=unconfined` / `apparmor=unconfined` を `runArgs` に追加 | AC-3 |
| `.devcontainer/Dockerfile` | `bubblewrap` などの OS パッケージをインストール | AC-5 |
| `.devcontainer/devcontainer.json` | `image` 参照からローカル Dockerfile の `build` へ切り替え | AC-5 |
| `.steering/20260703-codex-sakana-env-fixes/` | 要求、設計、タスク、レビューパック、HANDOFF を更新 | AC-4 |

## データ構造の変更

なし。DB、API スキーマ、型定義の変更はない。

## 影響範囲の分析

- `docs/` への影響: なし。アプリの基本設計ではなく、開発環境の局所修正。
- 既存コード・既存機能への影響: アプリ実行時の挙動には影響しない。Codex/Sakana 用の補助スクリプトと DevContainer 起動条件だけが対象。
- 後方互換 / マイグレーションの要否: DevContainer は Rebuild が必要。既存の `scripts/codex-sakana` の使い方は変えない。
- 参考ファイル: `dockerfile-memo.txt`。採用対象は OS パッケージ導入のみ。Claude Code 導入や NodeSource 追加は採用しない。

## 設計上の前提

- Sakana Fugu は OpenAI 互換 API だが、Codex の内部レビュー用モデル名 `codex-auto-review` は提供していない。
- Codex sandbox は bubblewrap/user namespace を使うため、DevContainer の seccomp/AppArmor が `unshare(CLONE_NEWUSER)` を遮ると失敗する。
- `SAKANA_API_KEY` はホスト環境変数から渡し、リポジトリには保存しない。

## 図表

不要。
