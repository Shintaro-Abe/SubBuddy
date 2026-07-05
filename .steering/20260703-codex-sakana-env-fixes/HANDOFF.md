# 引き継ぎ書（Codex/sakana プロファイル環境不具合の診断と是正）

> 作成：2026-07-03 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`main`
> 前提：同日の別作業（GitHub planning repo 同期の計画）は `.steering/20260703-github-planning-repo-sync/HANDOFF.md` を参照。本書はそのセッション中に判明した「環境不具合」だけを扱う。

---

## 1. 現在地（ひとことで）

- Sakana 公式の direct API 設定に合わせ、ローカルプロキシ依存を外した。
- `~/.codex/sakana.config.toml` と `scripts/codex-sakana` は `https://api.sakana.ai/v1` を直接参照する。
- Fugu が拒否する hosted `image_generation` tool を送らないよう、Codex の `image_generation` feature を無効化済み。
- `model_providers` は `~/.codex/sakana.config.toml` に移動済み。`.codex/config.toml` には置かない。
- `.devcontainer/devcontainer.json` は `SAKANA_API_KEY` の引き継ぎと seccomp/AppArmor 緩和を追加済み。
- `dockerfile-memo.txt` を参考に `.devcontainer/Dockerfile` を追加し、`bubblewrap` などの OS パッケージをイメージ作成時に入れる構成へ変更済み。
- `.codex/config.toml` は不要なノイズになるため削除済み。`.codex/fugu.json` は残し、`scripts/codex-sakana` は user-level の `--profile sakana` を使う。
- 反映には DevContainer の Rebuild が必要。

## 2. このセッションで判明したこと（診断結果）

- 起動経路：`scripts/codex-sakana` → `codex --profile sakana`。API 先は Sakana 公式の `https://api.sakana.ai/v1` に直接接続する。
- **過去の不具合A（昇格が常に失敗）**：ローカルプロキシ経由では Codex のレビュー用モデル名が Sakana 側に存在せず、権限昇格が失敗していた。公式手順ではローカルプロキシを使わないため、この回避策は削除した。
- **不具合B（サンドボックスが起動不可）**：非許可コマンドや `apply_patch` 実行時に `bwrap: No permissions to create new namespace`。`/proc/sys/user/max_user_namespaces=31736`（名前空間数は許可）なのに失敗するため、**コンテナの seccomp/AppArmor が `unshare(CLONE_NEWUSER)` を遮断**していると判断。
- 併発影響：読取 `cat`・複合シェル（`;`・パイプ・リダイレクト・ヒアドキュメント・`$()`・ワイルドカード）・`git rev-parse` 等が軒並み不可。承認済みプレフィックス（`ls -la` `sed -n` `perl -0pi -e` `mkdir -p` 等）のみ通る。

## 3. 状態・検証結果

- `~/.codex/config.toml` は現状 `model="gpt-5.5"` / `approvals_reviewer="auto_review"`（未編集）。
- ローカルプロキシは公式手順ではないため、`scripts/codex-sakana` からは使わない。
- `.devcontainer/devcontainer.json` は `SAKANA_API_KEY` をホスト環境変数から引き継ぎ、`runArgs` に `seccomp=unconfined` / `apparmor=unconfined` を追加済み。
- `.devcontainer/Dockerfile` は Debian Bookworm ベースを維持し、`bubblewrap` / `jq` / `ripgrep` / `fd-find` などを `apt` で導入する。
- 設計記録は `requirements.md` / `design.md` / `tasklist.md` / `review-pack.md` に追加済み。
- `~/.codex/sakana.config.toml` / `.codex/fugu.json` / `scripts/codex-sakana` は構文確認済み。実接続は `SAKANA_API_KEY` を環境に入れた後に行う。
- `image_generation` は `~/.codex/sakana.config.toml` と `scripts/codex-sakana` の両方で無効化済み。
- `codex --strict-config --version` と `codex --profile sakana --strict-config --disable image_generation --version` で、project-local `model_providers` 警告が出ないことを確認済み。

## 4. 再開時の最初の一手

1. DevContainer を Rebuild する。ローカル Dockerfile に切り替えたため、初回は OS パッケージのインストールが走る。
2. ホスト側に `SAKANA_API_KEY` を設定してから DevContainer を起動する。
3. `scripts/codex-sakana` を実行する。必要なら `SAKANA_MODEL=fugu-ultra`、`SAKANA_REASONING_EFFORT=xhigh` で調整する。
4. Rebuild 後も `bwrap: No permissions to create new namespace` が出る場合は、ホスト側 AppArmor 設定を確認する。Ubuntu 24.04 系では `kernel.apparmor_restrict_unprivileged_userns` が影響する場合がある。

## 5. 残・別スコープ（今回やらないこと）

- `~/.codex/config.toml` の直接編集。
- planning repo 同期の実装（別スレッド。上記 planning HANDOFF 参照）。

## 6. 申し送り（小）

- `~/.codex/config.toml` は未編集。今回の起動経路は direct API で、リポジトリ内プロキシは使わない。
- DevContainer Rebuild 前の現セッションでは、`apply_patch` など一部 sandbox 実行は引き続き失敗する。
- `SAKANA_API_KEY` の実値は環境変数で渡し、リポジトリには保存しない。
- コミットは未実施。コミット時は `pre-commit-secret-scan` を通す。
