# 要求内容 — TestFlight iOS 実装

> ステアリング：`20260707-testflight-ios-implementation`
> 作成日：2026-07-07
> 親計画：`../20260704-testflight-sprint-roadmap/`

## 背景・目的

TestFlight 20〜50人配信に向け、サーバー側整備は `../20260707-testflight-backend-readiness/` で完了済み。
次の圧縮不能ゲートは、Mac/Xcode 上で iOS アプリを作り、ネイティブ Apple サインインから DeviceActivity 集計値のクラウド送信まで一気通貫で通すこと。

一気通貫が成立したら、開発実機で 7日連続計測を即開始する。

## 変更・追加する機能の説明

### やること

- `apps/ios/` に SubBuddy iOS アプリを作成する。
- 本体アプリと `DeviceActivityMonitor Extension` の2ターゲット構成にする。
- ネイティブ Sign in with Apple で `POST /api/auth/apple/native` にログインする。
- サインイン後に iPhone デバイスを冪等登録し、同期 token を Keychain に保存する。
- FamilyControls / DeviceActivity で計測対象アプリをユーザーが選び、日別・バケット単位の集計値を端末内に保存する。
- フォアグラウンド化時に過去日の集計値を `/api/usage/daily` へ同期する。
- アカウント削除 UI から `DELETE /api/account` を呼び、成功後に Keychain / App Group のローカル状態を消す。
- 配布用 entitlement / App Group / codesign 確認手順を実装タスクに含める。
- 一気通貫確認後、7日連続計測を開始できる状態にする。

### やらないこと

- Shield / ManagedSettings UI は作らない。
- Shortcut Extension は作らない。`ios_shortcut` の source 値は互換のためサーバー側に残すだけ。
- 計測対象アプリの bundleId 自動突合はしない。
- 複数アプリ合算はしない。1サブスク=1計測対象アプリで進める。
- iOS 内のデバイス失効 UI は作らない。失効は Web 側に集約する。
- 詳細ログ、全アプリ一覧、FamilyActivityToken の中身、外部サービス ID/PW は送らない。
- Render 実デプロイと Apple Developer 実設定そのものは本ステアリングの主実装外。ただし疎通に必要な値・手順確認は行う。

## ユーザーストーリー

- TestFlight テスターとして、iPhone アプリでサインインして計測対象を選びたい。なぜなら Mac ローカルサーバーなしで利用量の集計を始めたいから。
- 開発者として、一気通貫が通った当日から7日連続計測を始めたい。なぜなら TestFlight 提出日を遅らせる最大要因を先に消したいから。
- ユーザーとして、アカウント削除時にクラウド上のデータと端末内の token が消えてほしい。なぜなら個人の支出・利用状況を扱うアプリだから。

## 受け入れ条件

- [ ] AC-1: `apps/ios/` に SwiftUI 本体アプリと DeviceActivityMonitor Extension の2ターゲットが存在する。
- [ ] AC-2: Bundle ID は `com.subbuddy.app` / `com.subbuddy.app.monitor`、App Group は `group.com.subbuddy.app`、Services ID は `com.subbuddy.web` を前提に設定される。
- [ ] AC-3: iOS ネイティブ Sign in with Apple で取得した identity token を `POST /api/auth/apple/native` へ送り、API token を取得できる。
- [ ] AC-4: サインイン直後に端末内生成の `clientDeviceId` で `POST /api/devices` を呼び、同期 token を Keychain に保存できる。
- [ ] AC-5: `.individual` 認可、FamilyActivityPicker、計測対象選択、監視登録が動く。
- [ ] AC-6: DeviceActivityMonitor Extension は通信せず、App Group に日別・バケット単位の集計値だけを書き込む。
- [ ] AC-7: 本体アプリはフォアグラウンド化時に過去日かつ未送信の集計値を `/api/usage/daily` へ送り、送信成功分のみ削除する。当日分は削除しない。
- [ ] AC-8: 同期 payload は `subscription_id` / `usage_date` / `used` / `usage_bucket` / `estimated_minutes_min` / `estimated_minutes_max` / `source` / `confidence` の集計値に限定し、詳細ログを含めない。
- [ ] AC-9: アカウント削除 UI から `DELETE /api/account` を呼び、成功後に Keychain / App Group のローカル状態を消せる。
- [ ] AC-10: 開発実機でサインイン→デバイス登録→計測対象選択→DeviceActivity 集計→クラウド送信の一気通貫を確認できる。
- [ ] AC-11: 配布 Archive で本体・Extension の `family-controls` と `application-groups` entitlement を `codesign` で確認できる。
- [ ] AC-12: build / lint 相当の Xcode 検証、既存 Web 側の必要な検証、secret 非漏洩確認を実施する。

## 制約事項

- PII・機微データ方針を最優先する。実在の個人データを fixture・スクリーンショット・ログ・コミットに含めない。
- iPhone から送るのは集計値のみ。詳細な Screen Time ログ、アプリ一覧、選択 token の中身は送らない。
- `clientDeviceId` と同期 token は Keychain に保存し、App Group 平文には置かない。
- Extension はネットワーク通信しない。本体アプリだけが同期する。
- `usage_date` は iPhone の現地日付を正とし、サーバー側で日付変換しない。
- local mode は残すが、本ステアリングの主対象は `cloud-testflight` mode。
