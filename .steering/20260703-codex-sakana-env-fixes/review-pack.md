# レビューパック - Codex / Sakana Fugu 環境是正

## 区分

- [x] 軽量（バグ修正・小改修。基本設計に触れない）
- [ ] フル（新機能・`docs/` に触れる変更。第二意見必須）

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 | Sakana provider が公式の direct API URL を使う | T-1 | 完了 |
| AC-2 | DevContainer に `SAKANA_API_KEY` を引き継ぐ | T-2 | 完了 |
| AC-3 | DevContainer に seccomp/AppArmor 緩和を追加 | T-3 | 完了 |
| AC-4 | `.steering` に判断と検証を記録 | T-4 | 完了 |
| AC-5 | DevContainer Dockerfile で `bubblewrap` などを導入 | T-5 | 完了 |
| AC-6 | プロジェクト内 Sakana Fugu 設定を追加 | T-6 | 完了 |
| AC-7 | `image_generation` tool を送らない | T-8 | 完了 |
| AC-8 | project-local `model_providers` 警告を消す | T-9 | 完了 |

> 漏れ・孤立の有無: なし。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- なし。HANDOFF で是正対象が示され、ユーザーが是正を依頼済み。DevContainer の security option 緩和はユーザーの明示承認済み。

### 設計上の前提（崩れると設計が変わるもの）

- `~/.codex/config.toml` はリポジトリ外なので、この作業では直接編集しない。
- DevContainer の sandbox 復旧には `unshare(CLONE_NEWUSER)` を許す必要がある。
- `SAKANA_API_KEY` の実値は環境変数だけで扱う。
- Sakana 公式 docs の Codex 手順は direct API 設定であり、ローカルプロキシではない。
- `codex --profile` は `$CODEX_HOME/<name>.config.toml` 前提のため、provider 定義は user-level profile に置く。
- Codex 0.142.5 では `image_generation` feature が既定で有効だが、Fugu は hosted `image_generation` tool を受けない。
- `model_providers` は project-local config では無視されるため、`~/.codex/sakana.config.toml` に置く。
- `dockerfile-memo.txt` は参考情報として扱い、SubBuddy で不要な Claude Code / NodeSource / Gemini CLI 導入は取り込まない。

## 影響範囲

- `docs/` への影響 / 更新案: なし。
- 既存コード・機能への影響: アプリ本体への影響なし。Codex/Sakana 補助環境だけが対象。
- マイグレーション・後方互換: DB 変更なし。DevContainer は Rebuild が必要。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| セキュリティ / プライバシー | API キーをファイルへ書くと漏えいする | `containerEnv` の `${localEnv:SAKANA_API_KEY}` と環境変数参照だけにした |
| セキュリティ / プライバシー | `--privileged` は権限が広すぎる | `seccomp=unconfined` / `apparmor=unconfined` に留めた |
| QA / テスト | 実接続なしでも最低限の検証が必要 | Node 構文チェックと JSON パース確認を行う |
| アーキテクト | `~/.codex/config.toml` 変更は環境依存で再現性が低い | 既存 `~/.codex/config.toml` は触らず、Sakana 専用 profile だけを更新した |
| アーキテクト | Dockerfile メモを丸ごと取り込むと Node / Codex 導入経路が二重化する | OS パッケージ導入だけ採用した |
| アーキテクト | `--profile sakana` は user-level profile を読む | provider 定義を `~/.codex/sakana.config.toml` に移した |
| QA / テスト | Fugu 呼び出しで `image_generation` tool が送られると API エラーになる | `features.image_generation = false` と `--disable image_generation` を追加した |
| QA / テスト | project-local `model_providers` は起動時警告になる | provider 定義を user-level profile へ移した |

### 第二意見（フル区分は必須）

- 手段: `grill-with-docs` により、未決事項・代替案・影響範囲をセルフレビュー。
- 要点: `--privileged` は避ける。シークレットは環境変数だけで渡す。開発環境修正なので `docs/` と ADR は不要。
- 反映した内容: DevContainer の権限緩和範囲を限定し、Sakana 接続は公式の direct API 設定に戻した。

## 承認

- [x] 未決事項ゼロを確認
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 上記をもって requirements / design / tasklist をまとめて承認
