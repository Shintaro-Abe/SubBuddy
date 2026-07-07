# タスクリスト — TestFlight 向けサーバー側整備（iOS 接続前）

> 後追い作成（2026-07-07 実施分の記録）。全タスク完了済み。

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | `usageBucketRank` 追加・`mergeUsageDaily` 実装・upsert を max マージ化 | AC-1 | 完了 | 再送でバケット下がらず・単体/実DBで確認 |
| T-2 | Apple token 検証を aud 許可リスト化（`APPLE_ALLOWED_CLIENT_IDS`） | AC-2 | 完了 | web/app 受理・リスト外拒否のテスト green |
| T-3 | `POST /api/auth/apple/native` 新設 | AC-3 | 完了 | ルート出力・Web callback と分離 |
| T-4 | `Device.clientDeviceId` ＋一意制約＋マイグレーション | AC-4, AC-7 | 完了 | `prisma validate` / `migrate deploy` 成功 |
| T-5 | デバイス登録 upsert 化（`registerDeviceForAppleUser`） | AC-4 | 完了 | 同一 clientDeviceId で1レコード（実DB確認） |
| T-6 | `DELETE /api/account`＋`deleteAppleUserAccount` | AC-5 | 完了 | カスケード物理削除・他user残存（実DB確認） |
| T-7 | `GET /api/health` 追加 | AC-6 | 完了 | `{ ok, mode }` 応答・DB非依存 |
| T-8 | Render 手順書 env 是正・health 手順・HTML 再生成 | AC-8 | 完了 | md/html に反映済み |
| T-9 | 実DB通し検証スクリプト（`verify:cloud-apis`） | AC-1,4,5,10 | 完了 | 全項目 PASS |
| T-10 | 本番ビルドの外部フォント依存を解消 | AC-9 | 完了 | `npm run build` 成功 |
| T-11 | `docs/` 反映（functional-design / architecture）・`.env.example` | AC-8 | 完了 | 差分反映済み |

## 実装中の逸脱ログ

- T-1：Prisma upsert が既存値参照できないため、`findUnique`→純関数マージ→`upsert` に変更。根幹は不変（再承認不要）。
- T-10：当初は build を外部取得許可で通す想定だったが、Render 環境での再現性のため next/font 自体を除去し system fallback に変更。表示フォントが変わる副作用あり（申し送り記録）。
- 環境制約：Xcode/iPhone 実機検証は Linux コンテナ不可。iOS 実装は本タスク対象外。

## 完了チェック

- [x] 全タスク完了
- [x] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [x] リント・型チェック実施（`lint` / `typecheck` green）
- [x] テスト（16 files / 120 passed）・本番ビルド成功・実DB検証全PASS
- [x] 必要な `docs/` 更新を反映
- [x] コミット（`pre-commit-secret-scan` で gitleaks クリーン確認後にコミット・`origin/main` へ push 済み）

## 反映状況（2026-07-07）

- gitleaks スキャン：no leaks found。
- コミット：`36bd910`（48 files changed / +1560 / -163）。関連ワークストリーム一式を一括コミット。
- push：`origin/main` に反映済み（`ee31764..36bd910`）。作業ツリーはクリーン。
