# 要求内容 - Codex / Sakana Fugu 環境是正

## 背景・目的

Sakana Fugu プロファイルで Codex を動かすと、権限昇格レビューと sandbox 実行が失敗する。DevContainer 再構築後も Codex CLI の通常操作、`apply_patch`、必要時の `require_escalated` が使える状態に戻す。

## 変更・追加する機能の説明

- やること:
  - `codex-auto-review` が Sakana 側で 404 になる問題を、ローカルプロキシで実モデルへ差し替えて回避する。
  - DevContainer に `SAKANA_API_KEY` を引き継げるようにする。
  - DevContainer で bubblewrap/user namespace が動くように security option を追加する。
  - `dockerfile-memo.txt` を参考に、`bubblewrap` などの OS パッケージを DevContainer イメージに入れる。
  - 判断理由と検証結果を `.steering` に残す。
- やらないこと:
  - `~/.codex/config.toml` を直接編集しない。
  - `--privileged` は使わない。
  - Sakana API キーや実データをリポジトリに保存しない。

## ユーザーストーリー

- 開発者として、Sakana Fugu プロファイルでも Codex の通常操作と権限昇格を使いたい。なぜなら、開発作業中に sandbox やレビューで停止しないようにしたいから。

## 受け入れ条件

- [ ] AC-1: `codex-auto-review` 宛てのリクエストが Sakana の実モデルへ差し替えられる。
- [ ] AC-2: DevContainer 起動時にホストの `SAKANA_API_KEY` をコンテナへ引き継げる。
- [ ] AC-3: DevContainer 設定に bubblewrap/user namespace を妨げる seccomp/AppArmor 制約の緩和が入っている。
- [ ] AC-4: 変更内容、前提、検証結果が `.steering/20260703-codex-sakana-env-fixes/` に記録されている。
- [ ] AC-5: DevContainer イメージ作成時に `bubblewrap` などの不足しやすい OS パッケージがインストールされる。

## 制約事項

- API キーなどのシークレットは環境変数で渡し、ファイルに実値を書かない。
- DevContainer の緩和は `--privileged` より狭い `seccomp=unconfined` / `apparmor=unconfined` に留める。
- 実接続テストは `SAKANA_API_KEY` がある場合のみ行う。
