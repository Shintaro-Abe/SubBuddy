# SubBuddy iOS

TestFlight向けiOSアプリの正式実装ディレクトリ。

## 構成

- `SubBuddyApp`: 本体アプリ
- `SubBuddyMonitorExtension`: DeviceActivity Monitor Extension
- `SubBuddyApp/Shared`: 本体アプリとExtensionで共有するコード
- `SubBuddyApp/Resources`: Web版と共通のOFLフォントとライセンス

## 生成

macOSで以下を実行する。

```bash
cd apps/ios
xcodegen generate
open SubBuddy.xcodeproj
```

生成時はApple Developer Team IDとAPI接続先を環境変数で渡す。

```bash
export APPLE_TEAM_ID=XXXXXXXXXX
export SUBBUDDY_API_BASE_URL=https://app.sub-buddy.com
xcodegen generate
```

Team IDの実値・秘密情報・個人情報はリポジトリに保存しない。`SUBBUDDY_API_BASE_URL`を設定せずにXcodeGenを再実行すると、生成プロジェクトの接続先は空になる。

利用者向けUIのSimulator buildと単体テストはMacで次を実行する。

```bash
SUBBUDDY_API_BASE_URL=https://app.sub-buddy.com apps/ios/scripts/verify-main-ui.sh
```

通常は利用可能なiPhone Simulatorが自動選択される。テスト先を固定したい場合だけ明示する。

```bash
SUBBUDDY_IOS_TEST_DESTINATION='platform=iOS Simulator,name=iPhone 17 Pro' apps/ios/scripts/verify-main-ui.sh
```

## 利用者向け画面

アプリは次の構成で提供する。

- 初回: データ説明、Appleサインイン、最初の契約、年間支出、計測説明、最初の見直し
- 主タブ: ホーム、契約、見直し
- 設定: データの扱い、Screen Time、同期、通知、端末・セッション、問い合わせ、出力、サインアウト、完全退会

API URLと内部契約IDは利用者へ入力させない。接続先は `SUBBUDDY_API_BASE_URL` のビルド設定で渡す。

書体はWeb版と同じ役割で、本文・見出しに`Zen Kaku Gothic New`、大見出しに`Shippori Mincho`、金額・主要数値に`BIZ UDPGothic`を使う。フォントはGoogle Fonts公式配布版をアプリへ同梱し、各OFLライセンスを`SubBuddyApp/Resources/FontLicenses/`に保持する。Dynamic TypeはSwiftUIの相対テキストスタイルで維持する。

## 実機確認

合成データ用アカウントで次の順に確認する。実在の契約・支出・利用量は証跡へ残さない。

1. 初回説明からAppleサインインまで進む。
2. 契約を1件登録し、年間支出を確認する。
3. 契約の一覧、詳細、編集、削除を確認する。
4. 支出の内訳と見直し詳細を確認する。
5. 契約詳細からScreen Timeを許可し、対象アプリを選ぶ。
6. 計測開始後、設定の同期から集計値を送る。
7. 設定から端末・セッション、サインアウト、完全退会を確認する。

未接続のデータ出力、問い合わせ送信、通知配信は、利用可能な操作として表示しない。

## 合成200契約の品質確認

XcodeのDebug実行引数へ`-subbuddy-quality-200`を追加すると、認証やクラウド保存を使わず、合成200契約の3タブUIを起動できる。契約一覧の安定性、検索、スクロール、Instruments性能確認に使う。

- 合成IDと`example.invalid`だけを使用する。
- クラウドへ契約・利用量を送信しない。
- `#if DEBUG`内のためReleaseビルドでは有効にならない。
- 確認後はSchemeの起動引数を無効にする。

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
