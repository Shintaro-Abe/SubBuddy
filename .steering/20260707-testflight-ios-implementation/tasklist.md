# タスクリスト — TestFlight iOS 実装

> ステアリング：`20260707-testflight-ios-implementation`
> 作成日：2026-07-07

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-0 | Apple Developer 側の Apple サインイン準備を確認 | AC-2, AC-3, AC-11 | 完了 | `manuals/apple-sign-in-setup.md` の作業完了。Team ID / Bundle ID / App Group ID / Services ID / Key ID / Return URL / private key の管理先が揃っている |
| T-1 | `apps/ios/` の Xcode project / workspace を作成し、本体アプリと Monitor Extension を追加 | AC-1, AC-2 | 未着手 | 2ターゲットが存在し、Bundle ID / App Group / Services ID の設定方針が確認できる |
| T-2 | entitlement / signing / App Group 設定を入れる | AC-2, AC-11 | 未着手 | 本体・Extension の capability が D1 どおりで、Archive 後に codesign 確認できる |
| T-3 | ネイティブ Sign in with Apple と `/api/auth/apple/native` の API client を実装 | AC-3 | 未着手 | identity token を送って API token を取得できる |
| T-4 | `clientDeviceId` 生成、`POST /api/devices`、Keychain 保存を実装 | AC-4 | 未着手 | 再ログイン・再起動後も同一端末として upsert でき、sync token が Keychain に残る |
| T-5 | サブスク一覧取得と計測対象アプリの対応付け UI を実装 | AC-5, AC-8 | 未着手 | 対象サブスクを選び、1サブスク=1計測対象アプリとして保存できる |
| T-6 | FamilyControls `.individual` 認可、FamilyActivityPicker、DeviceActivity 監視登録を実装 | AC-5 | 未着手 | 初回認可後に状態復元でき、不要な再要求をしない |
| T-7 | Monitor Extension で App Group へ日別・バケット単位の集計値を書き込む | AC-6, AC-8 | 未着手 | Extension は通信せず、集計値だけを保存する |
| T-8 | 本体アプリの `syncAll` を実装し、フォアグラウンド化時に過去日分を送る | AC-7, AC-8 | 未着手 | 送信成功した過去日だけ削除し、当日分は残る |
| T-9 | アカウント削除 UI とローカル消去を実装 | AC-9 | 未着手 | `DELETE /api/account` 成功後に Keychain / App Group の状態が消える |
| T-10 | 開発実機で一気通貫確認を実施 | AC-10 | 未着手 | サインイン→デバイス登録→計測対象選択→集計→送信が通る |
| T-11 | Xcode build / Archive / codesign と secret 非漏洩確認を実施 | AC-11, AC-12 | 未着手 | build 成功、entitlement 確認、ログ・差分に token / PII なし |
| T-12 | 一気通貫成立後に7日連続計測を開始し、開始日と観測方法を記録 | AC-10, AC-12 | 未着手 | 開始日、端末、対象サブスク、観測ルールが tasklist に追記されている |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装中の逸脱ログ

- なし

## 外部準備ログ

- 2026-07-07: `manuals/apple-sign-in-setup.md` の手作業は完了済み。リポジトリには実値・秘密鍵・個人情報を書かず、iOS 実装では設定名と疎通だけを確認する。

## 7日連続計測ログ

- 開始日: 未開始
- 対象端末: 未記録
- 対象サブスク: 未記録
- 判定: 未開始

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を満たす（トレーサビリティ表の各行を検証済み）
- [ ] Xcode build / Archive / codesign 確認実施
- [ ] 必要な Web 側 lint / typecheck / test 実施
- [ ] secret scan 実施
- [ ] 必要な `docs/` 更新を反映
