# タスクリスト - Codex / Sakana Fugu 環境是正

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | Sakana provider を公式の direct API URL へ設定 | AC-1 | 完了 | `~/.codex/sakana.config.toml` と `scripts/codex-sakana` が `https://api.sakana.ai/v1` を使う |
| T-2 | DevContainer に `SAKANA_API_KEY` の引き継ぎを追加 | AC-2 | 完了 | `.devcontainer/devcontainer.json` に環境変数設定がある |
| T-3 | DevContainer に seccomp/AppArmor 緩和を追加 | AC-3 | 完了 | `.devcontainer/devcontainer.json` に `runArgs` がある |
| T-4 | 変更内容と検証結果を記録 | AC-4 | 完了 | `review-pack.md` と `HANDOFF.md` が更新されている |
| T-5 | `dockerfile-memo.txt` を参考に DevContainer Dockerfile を追加 | AC-5 | 完了 | `.devcontainer/Dockerfile` と `devcontainer.json` の build 設定がある |
| T-6 | Sakana Fugu 用モデルカタログと起動スクリプトを追加 | AC-6 | 完了 | `~/.codex/sakana.config.toml` / `.codex/fugu.json` / `scripts/codex-sakana` の構文確認が通る |
| T-7 | 非公式のローカルプロキシを起動経路から削除 | AC-1, AC-6 | 完了 | `scripts/sakana-fugu-proxy.mjs` がなく、起動スクリプトが direct API を使う |
| T-8 | Fugu 非対応の `image_generation` tool を無効化 | AC-7 | 完了 | `~/.codex/sakana.config.toml` と `scripts/codex-sakana` で image_generation を無効化 |
| T-9 | `model_providers` を user-level profile へ移動 | AC-8 | 完了 | `.codex/config.toml` を削除し、`~/.codex/sakana.config.toml` に provider 定義がある |

## 実装中の逸脱ログ

- なし。

## 完了チェック

- [x] 全タスク完了
- [x] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] リント・型チェック実施（対象は Node 構文チェックと JSON パース確認）
- [x] 必要な `docs/` 更新を反映（今回は不要）
