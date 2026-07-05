# 要求内容 - Codex / Sakana Fugu 環境是正

## 背景・目的

Sakana Fugu を SubBuddy の Codex CLI から使えるようにする。API キーはユーザーが取得済み。Sakana 公式の direct API 設定に合わせ、ローカルプロキシに依存しない起動経路へ直す。

## 変更・追加する機能の説明

- やること:
  - Sakana 公式の `https://api.sakana.ai/v1` を provider の `base_url` に設定する。
  - Fugu が拒否する Codex の hosted `image_generation` tool を無効化する。
  - `model_providers` は project-local config で無視されるため、ユーザー側 profile `~/.codex/sakana.config.toml` に移す。
  - DevContainer に `SAKANA_API_KEY` を引き継げるようにする。
  - DevContainer で bubblewrap/user namespace が動くように security option を追加する。
  - `dockerfile-memo.txt` を参考に、`bubblewrap` などの OS パッケージを DevContainer イメージに入れる。
  - プロジェクト内には `.codex/fugu.json` と `scripts/codex-sakana` だけを残し、不要な `.codex/config.toml` は削除する。
  - 判断理由と検証結果を `.steering` に残す。
- やらないこと:
  - `~/.codex/config.toml` を直接編集しない。
  - Sakana API への接続にローカルプロキシを使わない。
  - `--privileged` は使わない。
  - Sakana API キーや実データをリポジトリに保存しない。

## ユーザーストーリー

- 開発者として、Sakana Fugu プロファイルでも Codex の通常操作と権限昇格を使いたい。なぜなら、開発作業中に sandbox やレビューで停止しないようにしたいから。

## 受け入れ条件

- [ ] AC-1: Sakana provider が `https://api.sakana.ai/v1` を直接参照する。
- [ ] AC-2: DevContainer 起動時にホストの `SAKANA_API_KEY` をコンテナへ引き継げる。
- [ ] AC-3: DevContainer 設定に bubblewrap/user namespace を妨げる seccomp/AppArmor 制約の緩和が入っている。
- [ ] AC-4: 変更内容、前提、検証結果が `.steering/20260703-codex-sakana-env-fixes/` に記録されている。
- [ ] AC-5: DevContainer イメージ作成時に `bubblewrap` などの不足しやすい OS パッケージがインストールされる。
- [ ] AC-6: `SAKANA_API_KEY` を環境変数で渡せば、`scripts/codex-sakana` から Sakana Fugu 用 Codex 設定が使われる。
- [ ] AC-7: Fugu 呼び出し時に `image_generation` tool が送られない。
- [ ] AC-8: Codex 起動時に project-local `model_providers` 無視の警告が出ない。

## 制約事項

- API キーなどのシークレットは環境変数で渡し、ファイルに実値を書かない。
- DevContainer の緩和は `--privileged` より狭い `seccomp=unconfined` / `apparmor=unconfined` に留める。
- 実接続テストは `SAKANA_API_KEY` がある場合のみ行う。
