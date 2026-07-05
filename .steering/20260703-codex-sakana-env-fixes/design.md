# 設計 - Codex / Sakana Fugu 環境是正

## 実装アプローチ

軽量修正として、ワークスペース内で完結する範囲で Sakana 公式の direct API 設定に合わせる。

1. Sakana Fugu の provider は `https://api.sakana.ai/v1` へ直接接続する。ローカルプロキシは公式推奨ではないため起動経路から外す。
2. Fugu は Responses API の hosted `image_generation` tool を拒否するため、Codex の `image_generation` feature を無効化する。
3. `model_providers` は project-local config で無視されるため、provider 定義は `~/.codex/sakana.config.toml` に置く。
4. DevContainer に `SAKANA_API_KEY` の環境変数引き継ぎと、bubblewrap/user namespace 用の `runArgs` を追加する。`--privileged` は避ける。
5. `dockerfile-memo.txt` のうち OS パッケージ導入部分だけを採用し、ローカル Dockerfile で `bubblewrap` などを入れる。Node / Codex / gitleaks は既存の `features` と `post_create.sh` に任せ、二重管理を避ける。
6. Sakana 公式の手動セットアップは user-level profile を使う。リポジトリには provider 定義を置かず、`scripts/codex-sakana` は `--profile sakana` を起動する。

## 変更するコンポーネント

| コンポーネント / ファイル | 変更内容 | 対応する受け入れ条件 |
|---|---|---|
| `~/.codex/sakana.config.toml` | Sakana provider の `base_url` を `https://api.sakana.ai/v1` にする | AC-1 |
| `~/.codex/sakana.config.toml` | `features.image_generation = false` を設定 | AC-7 |
| `.codex/config.toml` | 不要な project-local config として削除 | AC-8 |
| `.devcontainer/devcontainer.json` | `SAKANA_API_KEY` を `containerEnv` に追加 | AC-2 |
| `.devcontainer/devcontainer.json` | `seccomp=unconfined` / `apparmor=unconfined` を `runArgs` に追加 | AC-3 |
| `.devcontainer/Dockerfile` | `bubblewrap` などの OS パッケージをインストール | AC-5 |
| `.devcontainer/devcontainer.json` | `image` 参照からローカル Dockerfile の `build` へ切り替え | AC-5 |
| `.codex/fugu.json` | Fugu / Fugu Ultra の Codex 用モデルカタログを追加 | AC-6 |
| `scripts/codex-sakana` | ローカルプロキシへの依存をやめ、user-level `sakana` profile を起動し、`--disable image_generation` を付ける | AC-6, AC-7, AC-8 |
| `.steering/20260703-codex-sakana-env-fixes/` | 要求、設計、タスク、レビューパック、HANDOFF を更新 | AC-4 |

## データ構造の変更

なし。DB、API スキーマ、型定義の変更はない。

## 影響範囲の分析

- `docs/` への影響: なし。アプリの基本設計ではなく、開発環境の局所修正。
- 既存コード・既存機能への影響: アプリ実行時の挙動には影響しない。Codex/Sakana 用の補助スクリプトと DevContainer 起動条件だけが対象。
- 後方互換 / マイグレーションの要否: DevContainer は Rebuild が必要。既存の `scripts/codex-sakana` の使い方は変えない。
- 参考ファイル: `dockerfile-memo.txt`。採用対象は OS パッケージ導入のみ。Claude Code 導入や NodeSource 追加は採用しない。

## 設計上の前提

- Sakana 公式 docs は Codex 利用にローカルプロキシを要求していない。
- Sakana Fugu の tool support は `function` / `custom` で、Codex の hosted `image_generation` tool は送らない。
- Codex は project-local `.codex/config.toml` の `model_providers` を無視するため、Sakana provider は user-level profile に置く。
- Codex sandbox は bubblewrap/user namespace を使うため、DevContainer の seccomp/AppArmor が `unshare(CLONE_NEWUSER)` を遮ると失敗する。
- `SAKANA_API_KEY` はホスト環境変数から渡し、リポジトリには保存しない。
- 既定モデルは `fugu`。必要なら `SAKANA_MODEL=fugu-ultra`、推論強度は `SAKANA_REASONING_EFFORT=xhigh` で切り替える。

## 図表

不要。
