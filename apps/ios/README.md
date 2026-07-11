# SubBuddy iOS

TestFlight向けiOSアプリの正式実装ディレクトリ。

## 構成

- `SubBuddyApp`: 本体アプリ
- `SubBuddyMonitorExtension`: DeviceActivity Monitor Extension
- `SubBuddyApp/Shared`: 本体アプリとExtensionで共有するコード

## 生成

macOSで以下を実行する。

```bash
cd apps/ios
xcodegen generate
open SubBuddy.xcodeproj
```

生成時はApple Developer Team IDを環境変数で渡す。

```bash
export APPLE_TEAM_ID=XXXXXXXXXX
```

実値・秘密情報・個人情報はリポジトリに保存しない。

## 実機確認

アプリを起動したら、まず `API` 欄にRenderの公開URLを入力する。

```text
https://<service-name>.onrender.com
```

その後、次の順に確認する。

1. `Sign in with Apple` を実行する。
2. `Signed in and device registered` と表示されることを確認する。
3. `Request Authorization` でScreen Timeを許可する。
4. `Subscription ID` に開発用サブスクIDを入力する。
5. `Select Measured App` で計測対象アプリを選ぶ。
6. `Start Monitoring` を実行する。
7. 翌日以降、`Sync Past Records` で過去日分をRenderへ送信する。

> 注意: 現時点では一気通貫を早めるため、サブスク一覧取得は未実装。`Subscription ID` は手入力する。

## ID

- 本体アプリ Bundle ID: `com.subbuddy.app`
- Monitor Extension Bundle ID: `com.subbuddy.app.monitor`
- App Group: `group.com.subbuddy.app`
- Services ID: `com.subbuddy.web`

## Capability

本体アプリ:

- Sign in with Apple
- App Group
- Family Controls

Monitor Extension:

- App Group
- Family Controls

Monitor ExtensionにはSign in with Appleを付けない。
