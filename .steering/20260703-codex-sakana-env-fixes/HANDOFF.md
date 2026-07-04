# 引き継ぎ書（Codex/sakana プロファイル環境不具合の診断と是正）

> 作成：2026-07-03 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`main`
> 前提：同日の別作業（GitHub planning repo 同期の計画）は `.steering/20260703-github-planning-repo-sync/HANDOFF.md` を参照。本書はそのセッション中に判明した「環境不具合」だけを扱う。

---

## 1. 現在地（ひとことで）

- 作業中にファイル書き込み等がブロックされる原因を2つ特定し、ワークスペース内で是正した。
- `scripts/sakana-fugu-proxy.mjs` は `codex-auto-review` を Sakana の実モデルへ差し替える。
- `.devcontainer/devcontainer.json` は `SAKANA_API_KEY` の引き継ぎと seccomp/AppArmor 緩和を追加済み。
- `dockerfile-memo.txt` を参考に `.devcontainer/Dockerfile` を追加し、`bubblewrap` などの OS パッケージをイメージ作成時に入れる構成へ変更済み。
- 反映には DevContainer の Rebuild が必要。

## 2. このセッションで判明したこと（診断結果）

- 起動経路：`scripts/codex-sakana` → `codex --profile sakana`。API 先はローカルプロキシ `scripts/sakana-fugu-proxy.mjs`（`127.0.0.1:8787`）→ `https://api.sakana.ai` に転送（PID 例: proxy=22118, codex=22129）。
- **不具合A（昇格が常に失敗）**：`~/.codex/config.toml` に `approvals_reviewer = "auto_review"` があり、Codex はレビュー用に別モデル `codex-auto-review` を同じ base URL（`127.0.0.1:8787/v1/responses`）へ要求。Sakana 側に該当モデルが無く **HTTP 404 "Model codex-auto-review not found"** → `require_escalated`（権限昇格）が全て却下される。
- **不具合B（サンドボックスが起動不可）**：非許可コマンドや `apply_patch` 実行時に `bwrap: No permissions to create new namespace`。`/proc/sys/user/max_user_namespaces=31736`（名前空間数は許可）なのに失敗するため、**コンテナの seccomp/AppArmor が `unshare(CLONE_NEWUSER)` を遮断**していると判断。
- 併発影響：読取 `cat`・複合シェル（`;`・パイプ・リダイレクト・ヒアドキュメント・`$()`・ワイルドカード）・`git rev-parse` 等が軒並み不可。承認済みプレフィックス（`ls -la` `sed -n` `perl -0pi -e` `mkdir -p` 等）のみ通る。

## 3. 状態・検証結果

- `~/.codex/config.toml` は現状 `model="gpt-5.5"` / `approvals_reviewer="auto_review"`（未編集）。
- `scripts/sakana-fugu-proxy.mjs` は `payload.model === "codex-auto-review"` の場合に `SAKANA_REVIEW_MODEL` / `SAKANA_MODEL` / `fugu-ultra-20260615` へ差し替える。
- `.devcontainer/devcontainer.json` は `SAKANA_API_KEY` をホスト環境変数から引き継ぎ、`runArgs` に `seccomp=unconfined` / `apparmor=unconfined` を追加済み。
- `.devcontainer/Dockerfile` は Debian Bookworm ベースを維持し、`bubblewrap` / `jq` / `ripgrep` / `fd-find` などを `apt` で導入する。
- 設計記録は `requirements.md` / `design.md` / `tasklist.md` / `review-pack.md` に追加済み。

## 4. 再開時の最初の一手

1. DevContainer を Rebuild する。ローカル Dockerfile に切り替えたため、初回は OS パッケージのインストールが走る。
2. ホスト側に `SAKANA_API_KEY` を設定してから DevContainer を起動する。
3. 必要なら `SAKANA_REVIEW_MODEL` でレビュー用モデルを明示する。未指定時は `fugu-ultra-20260615`。
4. Rebuild 後も `bwrap: No permissions to create new namespace` が出る場合は、ホスト側 AppArmor 設定を確認する。Ubuntu 24.04 系では `kernel.apparmor_restrict_unprivileged_userns` が影響する場合がある。

## 5. 残・別スコープ（今回やらないこと）

- `~/.codex/config.toml` の直接編集。
- planning repo 同期の実装（別スレッド。上記 planning HANDOFF 参照）。

## 6. 申し送り（小）

- `~/.codex/config.toml` は未編集。今回の回避はリポジトリ内プロキシで行っている。
- DevContainer Rebuild 前の現セッションでは、`apply_patch` など一部 sandbox 実行は引き続き失敗する。
- `SAKANA_API_KEY` と `SAKANA_REVIEW_MODEL` の実値は環境変数で渡し、リポジトリには保存しない。
- コミットは未実施。コミット時は `pre-commit-secret-scan` を通す。
