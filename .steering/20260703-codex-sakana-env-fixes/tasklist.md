# タスクリスト - Codex / Sakana Fugu 環境是正

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | Sakana Fugu プロキシに `codex-auto-review` 差し替えを追加 | AC-1 | 完了 | `scripts/sakana-fugu-proxy.mjs` が構文チェックを通る |
| T-2 | DevContainer に `SAKANA_API_KEY` の引き継ぎを追加 | AC-2 | 完了 | `.devcontainer/devcontainer.json` に環境変数設定がある |
| T-3 | DevContainer に seccomp/AppArmor 緩和を追加 | AC-3 | 完了 | `.devcontainer/devcontainer.json` に `runArgs` がある |
| T-4 | 変更内容と検証結果を記録 | AC-4 | 完了 | `review-pack.md` と `HANDOFF.md` が更新されている |
| T-5 | `dockerfile-memo.txt` を参考に DevContainer Dockerfile を追加 | AC-5 | 完了 | `.devcontainer/Dockerfile` と `devcontainer.json` の build 設定がある |

## 実装中の逸脱ログ

- なし。

## 完了チェック

- [x] 全タスク完了
- [x] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] リント・型チェック実施（対象は Node 構文チェックと JSON パース確認）
- [x] 必要な `docs/` 更新を反映（今回は不要）
