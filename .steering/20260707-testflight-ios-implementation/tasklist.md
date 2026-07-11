# タスクリスト — TestFlight iOS 実装

> ステアリング：`20260707-testflight-ios-implementation`
> 作成日：2026-07-07

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-0 | Apple Developer 側の Apple サインイン準備を確認 | AC-2, AC-3, AC-11 | 完了 | `manuals/apple-sign-in-setup.md` の作業完了。Team ID / Bundle ID / App Group ID / Services ID / Key ID / Return URL / private key の管理先が揃っている |
| T-1 | `apps/ios/` の Xcode project / workspace を作成し、本体アプリと Monitor Extension を追加 | AC-1, AC-2 | 完了 | `apps/ios/project.yml` からXcode projectを生成し、`SubBuddyApp` と `SubBuddyMonitorExtension` の2ターゲット、Scheme、Extension埋め込み、実機起動を確認済み |
| T-2 | entitlement / signing / App Group 設定を入れる | AC-2, AC-11 | 進行中 | 本体・Extension の capability は D1 どおり確認済み。Debug実機ビルド・起動確認済み。Archive 後の codesign 確認は未実施 |
| T-3 | ネイティブ Sign in with Apple と `/api/auth/apple/native` の API client を実装 | AC-3 | 進行中 | iOS UI / API client 実装済み。Render URL設定後、実機でidentity token送信を検証する |
| T-4 | `clientDeviceId` 生成、`POST /api/devices`、Keychain 保存を実装 | AC-4 | 進行中 | `clientDeviceId` 生成、device登録API、device sync token Keychain保存を実装済み。実機疎通は未検証 |
| T-5 | サブスク一覧取得と計測対象アプリの対応付け UI を実装 | AC-5, AC-8 | 進行中 | 一気通貫優先でsubscriptionId手入力＋計測対象選択UIを実装済み。サブスク一覧取得は未実装 |
| T-6 | FamilyControls `.individual` 認可、FamilyActivityPicker、DeviceActivity 監視登録を実装 | AC-5 | 進行中 | FamilyActivityPicker と DeviceActivity 監視登録を実装済み。実機で監視開始を検証する |
| T-7 | Monitor Extension で App Group へ日別・バケット単位の集計値を書き込む | AC-6, AC-8 | 進行中 | Extension の App Group 書き込み骨格を実装済み。実機で閾値到達時の記録発生を検証する |
| T-8 | 本体アプリの `syncAll` を実装し、フォアグラウンド化時に過去日分を送る | AC-7, AC-8 | 進行中 | device sync tokenで過去日レコードのみ送信し、成功分を削除する実装を追加。フォアグラウンド自動実行は未実装 |
| T-9 | アカウント削除 UI とローカル消去を実装 | AC-9 | 未着手 | `DELETE /api/account` 成功後に Keychain / App Group の状態が消える |
| T-10 | 開発実機で一気通貫確認を実施 | AC-10 | 未着手 | サインイン→デバイス登録→計測対象選択→集計→送信が通る |
| T-11 | Xcode build / Archive / codesign と secret 非漏洩確認を実施 | AC-11, AC-12 | 未着手 | build 成功、entitlement 確認、ログ・差分に token / PII なし |
| T-12 | 一気通貫成立後に7日連続計測を開始し、開始日と観測方法を記録 | AC-10, AC-12 | 未着手 | 開始日、端末、対象サブスク、観測ルールが tasklist に追記されている |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装中の逸脱ログ

- 2026-07-09: Linux workspace 上で `apps/ios/` を追加し、XcodeGen 定義・本体アプリ・DeviceActivity Monitor Extension・共有コードの骨格を作成。Mac/Xcode 側で `.xcodeproj` 生成、2ターゲット確認、`SubBuddyApp` Scheme追加後の実機起動、Screen Time認可、本体アプリへのExtension埋め込みを確認済み。Archive / codesign は未実施。
- 2026-07-09: App Store Connect upload 時にApp Icon不足と `CFBundleIconName` 不足で失敗。`Assets.xcassets/AppIcon.appiconset`、`CFBundleIconName: AppIcon`、`ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` を追加して再Archive対象とした。
- 2026-07-09: 一気通貫を早めるため、T-5は正式なサブスク一覧取得より先にsubscriptionId手入力で実装。T-3/T-4/T-6/T-7/T-8の最小コードを追加し、Render URL入力→Appleサインイン→device登録→計測対象選択→監視開始→過去日同期を同一画面で試せる状態にした。

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
