# タスクリスト — クラウド認証境界設計

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | 実行モードの設定仕様を定義する | AC-1, AC-9 | 完了 | `local` / `cloud-testflight` / `production` の共通部分・差分・環境変数方針が文書化される |
| T-2 | 内部認証モデルを設計する | AC-2 | 完了 | `AuthenticatedActor` 相当の型・属性・失敗時の扱いが決まる |
| T-3 | 認証 provider 境界を設計する | AC-3, AC-8 | 完了 | local auth / Apple auth / device token auth の入力・出力・責務が決まる |
| T-4 | `USAGE_SYNC_TOKEN` の位置づけを整理する | AC-4 | 完了 | local mode 用の互換手段として残すか、名前変更するかの方針が文書化される |
| T-5 | iPhone 同期 API の認証フローを設計する | AC-5, AC-8 | 完了 | device token から `user_id` を解決し、body のユーザー指定を信じないフローが決まる |
| T-6 | テナント分離の repository / API 方針を設計する | AC-6 | 完了 | `user_id` 絞り込みルール、禁止パターン、レビュー観点が決まる |
| T-7 | テナント越え防止テスト方針を作る | AC-6 | 完了 | 複数ユーザーの合成データで見るべき単体/APIテスト観点が文書化される |
| T-8 | クラウド保存データ境界を文書化する | AC-7 | 完了 | 保存するデータ/保存しないデータが `docs/` 更新案に反映される |
| T-9 | Apple サインインからデバイス登録までのフローを設計する | AC-8 | 完了 | Web/iPhoneログイン、device登録、token失効/再発行の流れが決まる |
| T-10 | 後続フェーズの順序を文書化する | AC-9 | 完了 | Web/API/DB/認証 → PaaS → iPhone送信 → TestFlight の順序が `review-pack` と `docs` 更新案に反映される |
| T-11 | 永続ドキュメント更新案を作る | AC-10 | 完了 | `architecture.md` / `functional-design.md` / `product-requirements.md` の更新箇所が列挙される |
| T-12 | セキュリティ/プライバシー観点のセルフレビューを実施する | AC-6, AC-7, AC-10 | 完了 | PII、認証、テナント分離、ログ出力、削除導線の指摘と対応が記録される |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装中の逸脱ログ

- 2026-07-02: 承認済みの認証境界仕様に沿って、Apple identity token 検証、`users.apple_subject_hash`、Apple callback API、device 登録・失効 API、device sync token 発行を追加した。根幹設計の変更はなし。

## 後続実装ログ

| 日付 | 実装 | 検証 |
|---|---|---|
| 2026-07-02 | Apple サインイン前段の identity token 検証、Apple user upsert、device 登録・失効 API、sync token 発行 | `npx prisma generate` / `npx prisma migrate deploy` / `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build` |

## 完了チェック

- [x] 全タスク完了
- [x] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] リント・型チェック実施（コード変更なしのため対象外）
- [x] 必要な `docs/` 更新を反映（glossary・ADR作成済み。永続docs本文更新案は docs-update-plan.md に整理）
- [x] 実 PII・秘密情報を含めていないことを確認
