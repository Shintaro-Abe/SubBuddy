# 段階7：iPhoneアプリ配布申請ガイド

> ⚠ 送信先に関する重要注記（2026-07 改訂）：本ガイドの一部は `local mode`（自分の Mac にだけ送る）を前提に書かれていた。
> 現在の到達点は `cloud-testflight mode` で、iPhone は **SubBuddy が運用するクラウド API** へ集計値を送る。
> プライバシーポリシー・App 説明・App Privacy・Family Controls 回答では、送信先を実態どおり「クラウド」と説明する。
> 「ユーザー自身の Mac にだけ送る」という表現は `local mode` の説明としてのみ使う（`docs/architecture.md` §4.2 / ADR 0001）。

SubBuddy を TestFlight / App Store で配る前に、本体アプリと DeviceActivityMonitor 拡張の配布設定、Family Controls 配布許可、App Store Connect の申告をそろえる。
ローカルファーストで自分の端末だけに入れる場合、この手順は不要。

この手順書を最後まで実行しても、アプリは自動ではリリースされない。
到達点は「配布用の署名設定、Family Controls 配布許可、プライバシー申告、提出前のビルド確認が整った状態」まで。
実際のリリースには、この後に Archive のアップロード、TestFlight 確認、App Store Connect での審査提出、Apple の審査通過、公開操作が必要。

> ⚠ Spike 用の Bundle ID で申請しない。製品版の本体 Bundle ID と Monitor 拡張 Bundle ID を確定してから進める。
> ⚠ App ID / App Group / Services ID / Sign in with Apple private key の登録は、この手順書では扱わない。先に `manuals/apple-sign-in-setup.md` を完了する。
> ⚠ Services ID と Sign in with Apple private key は本体アプリ/Webログイン用。Monitor 拡張側では設定しない。

## 1. 事前に用意する

○ 目的：Apple Developer と App Store Connect で使う値を先にそろえる。

□ 操作

- Apple Developer Program の有料アカウント
- App Store Connect に作成した SubBuddy のアプリ
- 製品版の本体 Bundle ID
- 製品版の Monitor 拡張 Bundle ID
- App Group ID
- App Apple ID
- 配布用証明書（なければ手順5で作成）
- 本番用の Xcode プロジェクト、または本番用の App ターゲットと Monitor 拡張ターゲット（なければ手順7で作成）
- 公式ページ URL または GitHub リポジトリ URL
- プライバシーポリシー URL
- 申請用スクリーンショット
- `manuals/apple-sign-in-setup.md` に沿って登録済みの本体アプリ App ID
- `manuals/apple-sign-in-setup.md` に沿って登録済みの Monitor 拡張 App ID
- `manuals/apple-sign-in-setup.md` に沿って登録済みの App Group

**入力値の例**

| 種類 | 値 |
|---|---|
| 本体 Bundle ID | `〔製品版の本体 Bundle ID〕` |
| Monitor 拡張 Bundle ID | `〔製品版のMonitor拡張 Bundle ID〕` |
| App Group ID | `group.〔製品版の本体 Bundle ID〕` |

> ✅ 本体アプリと Monitor 拡張の App ID / App Group は、`manuals/apple-sign-in-setup.md` に沿って登録済みである。
> ✅ 上の値がそろってから申請する。Bundle ID を後で変えると再申請・再署名になる。

## 2. Capability Requests の状態を確認する

○ 目的：Family Controls 配布許可の申請が必要か、すでに割り当て済みかを確認する。

□ 操作

1. Apple Developer にログインする。
2. `Certificates, Identifiers & Profiles` の Identifiers 一覧を開く。

```bash
https://developer.apple.com/account/resources/identifiers/list
```

3. 本体アプリの App ID を開く。
4. `Capability Requests` タブを開く。
5. `Family Controls (Distribution)` または `Family Controls` の状態を見る。
6. Identifiers 一覧へ戻る。
7. Monitor 拡張の App ID でも同じ確認をする。

| 状態 | 判断 | 次にやること |
|---|---|---|
| `Assigned` | Apple がその App ID に配布用 Family Controls を割り当て済み | 手順4で Capability を有効化する |
| `Request` が押せる | まだ割り当てられていない | 手順3で申請する |
| `Pending` など審査中の表示 | 申請済みで結果待ち | 重複申請せず待つ |

> ⚠ `Family Controls (development)` は開発用。TestFlight / App Store 配布には、配布用の `Family Controls (Distribution)` が必要。
> ⚠ 本体アプリと Monitor 拡張は別 App ID。両方の状態を確認する。

## 3. Family Controls の配布許可を申請する

○ 目的：Screen Time / Family Controls を配布版で使う許可を Apple に申請する。

□ 操作

1. Identifiers 一覧で、本体アプリの App ID を開く。
2. `Capability Requests` タブを開く。
3. `Family Controls` または `Family Controls (Distribution)` の `Request` を押す。
4. 名前、Team ID、メールアドレスが正しいことを確認する。
5. `Get Entitlement` を押す。
6. Identifiers 一覧へ戻る。
7. Monitor 拡張の App ID を開く。
8. `Capability Requests` タブから、同じ手順でもう1件申請する。

> ⚠ 申請は Bundle ID ごとに必要。本体だけでなく Monitor 拡張も必ず申請する。
> ⚠ Apple 公式ヘルプでは、managed capability の申請は Account Holder が行う必要がある。
> ⚠ 2026-07-04 時点の画面では、用途説明文や URL を入力する欄が出ない場合がある。その場合は、表示済みの名前・Team ID・メールアドレスを確認して `Get Entitlement` を押す。
> ✅ 本体と Monitor 拡張の2件を申請済みにする。承認メールが届くまで数日から数週間かかることがある。
> ✅ 2026-07-04 の実績では、`Family Controls (Distribution)` の申請後すぐに承認メールが届いた。ただし Apple 側の審査時間は保証されないため、すぐ届かない場合も審査中として扱う。

### 本体アプリの確認値

| 欄 | 確認値 |
|---|---|
| Name | Apple Developer アカウントの名前 |
| Team ID | 対象チームの Team ID |
| Email | Apple から連絡を受け取れるメールアドレス |
| App ID | `〔製品版の本体 Bundle ID〕` の App ID を開いていること |
| Requested capability | `Family Controls (Distribution)` または `Family Controls` |

> ✅ 画面に入力欄が名前・Team ID・メールアドレスしか無い場合は、そのまま `Get Entitlement` を押す。

### 求められた場合に使う説明文

Apple から追加説明を求められた場合、または App Review の審査メモに書く場合は、下の文を使う。

**Describe your app**

```bash
SubBuddy is a personal subscription-management app for a single user. The user maps each subscription they pay for to one app they choose, and the app shows coarse usage signals for that app so the user can decide whether the subscription is still worth paying for. It is a savings and decision-support tool for the user's own subscriptions, not a monitoring or parental-control product.
```

**How does your app use Family Controls?**

```bash
The app uses Family Controls with individual authorization only (AuthorizationCenter.requestAuthorization(for: .individual)). The user selects one of their own apps with FamilyActivityPicker and authorizes monitoring on their own device. A DeviceActivityMonitor extension observes DeviceActivityEvent thresholds and produces a coarse daily usage bucket, such as "used 120+ minutes today". ApplicationTokens and detailed activity logs never leave the device. Only the coarse daily usage bucket is sent over HTTPS to SubBuddy's own cloud backend, associated with the signed-in user's own account. App names, detailed activity logs, screen contents, and location are never collected. The data is not shared with third parties and is not used for advertising or tracking.
```

**Does the app provide parental controls?**

```bash
No. SubBuddy has no parental-control, guardian, MDM, or child-supervision features. Authorization is individual (.individual): a person monitors only their own usage on their own device to make personal spending decisions.
```

### Monitor 拡張について求められた場合の説明文

```bash
This request is for the DeviceActivityMonitor extension of SubBuddy (bundle ID: 〔製品版のMonitor拡張 Bundle ID〕). The extension has no user interface. It runs in the background to observe DeviceActivityEvent thresholds and writes coarse, bucketed usage values into the shared App Group container. The containing app reads those buckets and sends only the coarse usage buckets over HTTPS to SubBuddy's own cloud backend, associated with the signed-in user's own account. A separate request is filed for the containing app's bundle ID.

SubBuddy is a personal subscription-management app for a single user. The user maps each subscription they pay for to one app they choose, and the app shows coarse usage signals for that app so the user can decide whether the subscription is still worth paying for. It is a savings and decision-support tool for the user's own subscriptions, not a monitoring or parental-control product.
```

## 4. App ID の配布用 Capability を有効化する

○ 目的：承認済みの Family Controls 配布許可を、実際の App ID 設定へ反映する。

□ 操作

1. Apple Developer の Identifiers 一覧を開く。

```bash
https://developer.apple.com/account/resources/identifiers/list
```

2. 本体アプリの App ID を開く。
3. `Capabilities` タブを開く。
4. `App Groups` が有効で、事前に登録済みの App Group が選ばれていることを確認する。
5. `Family Controls (Distribution)` または `Family Controls` が有効化できる場合は、有効にして保存する。
6. Identifiers 一覧へ戻る。
7. Monitor 拡張の App ID を開く。
8. `Capabilities` タブを開く。
9. `App Groups` が有効で、本体と同じ App Group が選ばれていることを確認する。
10. `Family Controls (Distribution)` または `Family Controls` が有効化できる場合は、有効にして保存する。

> ⚠ `Assigned` は割り当て済みという意味で、署名済みビルドに自動で入るという意味ではない。App ID の Capabilities、有効なプロビジョニングプロファイル、Xcode の Signing & Capabilities まで反映する。
> ⚠ Monitor 拡張に `Sign in with Apple` は付けない。Services ID と private key も Monitor 側では使わない。
> ✅ 本体アプリと Monitor 拡張の両方で、App Group と配布用 Family Controls が有効になっている。

## 5. 配布用証明書を作る

○ 目的：TestFlight / App Store 提出ビルドへ署名するための `Apple Distribution` 証明書を用意する。

□ 操作

1. Mac で `キーチェーンアクセス` を開く。
2. メニューから `キーチェーンアクセス > 証明書アシスタント > 認証局に証明書を要求...` を開く。
3. `ユーザのメールアドレス` に Apple Developer アカウントのメールアドレスを入れる。
4. `通称` に識別しやすい名前を入れる。

```bash
SubBuddy Apple Distribution
```

5. `CA のメールアドレス` は空欄にする。
6. `ディスクに保存` を選ぶ。
7. `続ける` を押し、`.certSigningRequest` ファイルを保存する。
8. Apple Developer の Certificates 一覧を開く。

```bash
https://developer.apple.com/account/resources/certificates/list
```

9. `+` を押す。
10. `Software` の `Apple Distribution` を選ぶ。
11. `Continue` を押す。
12. この節の手順7で保存した `.certSigningRequest` ファイルをアップロードする。
13. `Continue` または `Generate` を押す。
14. 発行された `.cer` ファイルをダウンロードする。
15. キーチェーンアクセスの左側で `ログイン` キーチェーンを選ぶ。
16. ダウンロードした `.cer` ファイルを `ログイン` キーチェーンへドラッグ＆ドロップする。

> ⚠ 既に有効な `Apple Distribution` 証明書があり、その秘密鍵もこのMacのキーチェーンに入っている場合は、新しく作らず既存の証明書を使ってよい。
> ⚠ Apple 公式ヘルプでは、配布用証明書の作成は Account Holder または Admin 権限が必要。
> ⚠ `.cer` を追加するときに “システムルート” キーチェーンのエラーが出た場合は、`システムルート` ではなく `ログイン` キーチェーンを選び直してから追加する。`Apple Distribution` 証明書はルート証明書ではないため、システムルートの信頼設定を変更しない。
> ⚠ 配布用証明書はチームの署名資産。`.certSigningRequest`、`.cer`、秘密鍵を書類やリポジトリに置かない。秘密鍵を共有する必要がある場合は、チーム内の安全な手段だけを使う。
> ✅ キーチェーンアクセスで `Apple Distribution: 〔チーム名〕 (〔Team ID〕)` が表示され、秘密鍵がひも付いていることを確認する。

## 6. 配布用プロビジョニングプロファイルを作る

○ 目的：TestFlight / App Store 提出ビルドへ署名するための配布プロファイルを作る。

□ 操作

1. Profiles の一覧を開く。

```bash
https://developer.apple.com/account/resources/profiles/list
```

2. `+` を押す。
3. `Distribution` の `App Store Connect` または `App Store` を選ぶ。
4. `Continue` を押す。
5. まず Monitor 拡張の App ID を選ぶ。
6. 配布用証明書を選ぶ。
7. Profile Name に次の値を入れる。

```bash
SubBuddy Monitor Extension Distribution
```

8. `Generate` を押す。
9. 同じ手順で本体アプリ用の配布プロファイルも作る。

**本体アプリ用の Profile Name**

```bash
SubBuddy App Distribution
```

> ⚠ 本体用と Monitor 拡張用の2つが必要。片方だけだと提出時に署名エラーになる。
> ⚠ Family Controls の承認・有効化前に作った配布プロファイルは古い可能性がある。Capability を直した後に作り直す。
> ✅ 手順5で用意した配布用証明書を選んで、Monitor 拡張用と本体アプリ用の2つを作成する。

## 7. 本番用 Xcode プロジェクトまたはターゲットを用意する

○ 目的：Spike 用ではなく、製品版 Bundle ID で署名する本番用の App ターゲットと Monitor 拡張ターゲットを用意する。

□ 操作

1. 現在の Xcode 構成を確認する。
2. Spike 用プロジェクトしかない場合は、次のどちらかを選ぶ。
3. 新しい Xcode プロジェクトとして本番用アプリを作る。
4. または、既存の Xcode ワークスペース内に本番用 App ターゲットを追加する。
5. 本番用 App ターゲットの Product Name を `SubBuddy` にする。
6. 本番用 App ターゲットの Bundle Identifier を製品版の本体 Bundle ID にする。
7. 本番用 App ターゲットに DeviceActivityMonitor 拡張ターゲットを追加する。
8. Monitor 拡張ターゲットの Bundle Identifier を製品版の Monitor 拡張 Bundle ID にする。
9. Spike で検証した必要な実装だけを、本番用 App ターゲットと Monitor 拡張ターゲットへ移す。

> ⚠ Spike 用 Bundle ID や Spike 用ターゲットを、提出用ビルドに流用しない。製品版 Bundle ID は、本番用ターゲットだけに設定する。
> ⚠ 新しい `.xcodeproj` を必ず作る必要はない。既存ワークスペース内に本番用ターゲットを分けてもよい。重要なのは、Spike 用ターゲットと提出用ターゲットを混ぜないこと。
> ✅ 本番用 App ターゲットと本番用 Monitor 拡張ターゲットがあり、それぞれ製品版 Bundle ID になっている。

## 8. Xcode の Signing & Capabilities を合わせる

○ 目的：Apple Developer ポータルで有効化した値を Xcode 側にも反映する。

□ 操作

1. Xcode でプロジェクトを開く。
2. 本体ターゲットの `Signing & Capabilities` を開く。
3. `Bundle Identifier` を製品版の本体 Bundle ID にする。
4. `App Groups` を追加し、事前に登録済みの App Group にチェックを入れる。
5. `Family Controls` を追加する。
6. Monitor 拡張ターゲットの `Signing & Capabilities` を開く。
7. `Bundle Identifier` を製品版の Monitor 拡張 Bundle ID にする。
8. `App Groups` を追加し、本体と同じ App Group にチェックを入れる。
9. `Family Controls` を追加する。
10. 手動署名なら、手順6で作った配布プロファイルを各ターゲットへ割り当てる。

> ⚠ Xcode に `Family Controls` を追加しても、Apple Developer 側で配布用 entitlement が未承認なら提出用ビルドは完成しない。
> ✅ 本体と Monitor 拡張の両方に、同じ App Group と Family Controls が表示されている。

## 9. PrivacyInfo.xcprivacy を追加する

○ 目的：Apple のプライバシーマニフェスト（＝収集データと理由付き API の申告ファイル）を入れる。

□ 操作

1. Xcode で `File > New > File...` を開く。
2. `Resource > App Privacy File` を選ぶ。
3. 本体ターゲットに `PrivacyInfo.xcprivacy` を追加する。
4. 同じ手順で Monitor 拡張ターゲットにも追加する。
5. 本体用ファイルに下の XML を貼る。

```bash
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeProductInteraction</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
    </array>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

6. Monitor 拡張用ファイルに下の XML を貼る。

```bash
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

> ⚠ ファイル名は `PrivacyInfo.xcprivacy` のままにする。本体と Monitor 拡張の両方に入れる。

## 10. プライバシーポリシーを公開する

○ 目的：App Store Connect に貼る URL を用意する。

□ 操作

1. GitHub Pages、README、公式サイトなどに下の本文を公開する。
2. 公開 URL を控える。
3. App Store Connect に同じ URL を入力する。Apple から追加説明を求められた場合も、この URL を使う。

```bash
# SubBuddy プライバシーポリシー

SubBuddy は、ユーザー自身が契約しているサブスクリプションを見直すための個人向けアプリです。

## 取得する情報

SubBuddy は、ユーザーが自分で選んだアプリの使用時間を、iPhone の中で段階化した集計値として扱います。
例：その日に一定時間以上使ったかどうか、または「120分以上」のような大まかな使用量の目安。

SubBuddy は、アプリ名そのもの、詳しい利用ログ、画面内容、通信内容、連絡先、位置情報を収集しません。

## 情報の利用目的

使用時間の集計値は、ユーザーが「このサブスクリプションを払い続ける価値があるか」を判断するためにだけ使います。
広告、追跡、第三者向けの分析、プロファイリングには使いません。

## 情報の送信先

使用時間の集計値は、HTTPS で SubBuddy が運用するクラウドに、サインインしたユーザー本人のアカウントに紐づけて送信します。
集計値は第三者のサーバーには提供しません。（自分の Mac だけで完結させたい場合は local mode を使います。）

## 第三者提供

SubBuddy は、取得した使用時間の集計値を第三者へ販売、共有、提供しません。

## 子ども・他人の監視について

SubBuddy は、保護者による子どもの見守り、従業員監視、MDM、第三者の行動監視を目的としたアプリではありません。
使用時間の取得は、ユーザー本人の端末で、ユーザー本人の許可がある場合に限ります。

## お問い合わせ

本ポリシーに関する問い合わせ先：〔問い合わせ先URLまたはメール〕
```

## 11. App Store Connect にアプリ情報を入れる

○ 目的：Family Controls 申請と矛盾しない説明で App Store Connect を埋める。

□ 操作

1. App Store Connect を開く。

```bash
https://appstoreconnect.apple.com/apps
```

2. 対象アプリを開く。
3. `App情報` と対象バージョンの情報を入力する。

| 欄 | 入力値 |
|---|---|
| App名 | `SubBuddy` |
| サブタイトル | `使ってないサブスクに気づく` |
| プライマリカテゴリ | `ファイナンス` |
| セカンダリカテゴリ | `ユーティリティ` |
| サポートURL | `〔GitHub Issues など問い合わせ先 URL〕` |
| マーケティングURL | `〔公式ページまたはGitHub URL〕` |
| プライバシーポリシーURL | `〔プライバシーポリシーURL〕` |
| 年齢制限 | `4+` |
| キーワード | `サブスク,サブスクリプション,解約,固定費,節約,家計,支出管理,使用時間,見直し,定期購入` |

**プロモーションテキスト**

```bash
使っていないサブスクに気づけます。契約に「対応するアプリの使用時間の目安」を並べて表示し、解約か継続かをあなた自身で判断。使用時間は iPhone 内で集計値にし、SubBuddy のクラウドにあなたのアカウントとして安全に送ります。広告・追跡はありません。
```

**説明**

```bash
SubBuddy（サブバディ）は、あなたが払っているサブスクを1つずつ見直すための、個人向けアプリです。

契約中のサブスクに、あなたが選んだアプリを対応づけると、そのアプリを最近どれくらい使っているかを、段階化した目安で表示します。「あまり使っていないのに払い続けている」ものに気づき、解約するか続けるかを、あなた自身で判断できます。

■ プライバシーへの配慮
・使用時間は iPhone の中で段階化した集計値（例：「120分以上」）にします。
・その集計値は、SubBuddy が運用するクラウドに、あなたのアカウントとして安全に送ります。
・アプリ名や詳しい利用ログを、当社や第三者に送ることはありません。
・広告や追跡には一切利用しません。

使用時間の計測には、iOS の Family Controls（スクリーンタイム）を、あなた自身の許可のもとでのみ使用します。他人を監視する機能はありません。
```

## 12. App Privacy を登録する

○ 目的：App Store のプライバシー表示を登録する。

□ 操作

1. App Store Connect で対象アプリを開く。
2. `Appのプライバシー` を開く。
3. `データを収集していますか？` は `はい` を選ぶ。
4. データタイプは `使用状況データ > 製品とのやり取り` だけを選ぶ。
5. 用途は `Appの機能` だけを選ぶ。
6. `ユーザーに関連付けられますか？` は `はい` を選ぶ。
7. `追跡に使用しますか？` は `いいえ` を選ぶ。
8. 保存する。

> ✅ 表示結果が「使用状況データ / ユーザーに関連付けられる / 追跡なし / Appの機能」だけになっていることを確認する。

## 13. ビルドに entitlement が入ったか確認する

○ 目的：提出するビルドに必要な権限が入っているか確認する。

□ 操作

1. Release / Archive 用にビルドする。
2. 本体 `.app` と Monitor 拡張 `.appex` のパスを確認する。
3. ターミナルで本体アプリを確認する。

```bash
codesign -d --entitlements :- "〔SubBuddy.appのパス〕"
```

4. Monitor 拡張も確認する。

```bash
codesign -d --entitlements :- "〔Monitor拡張.appexのパス〕"
```

**`.appex` パスの例**

```bash
~/Library/Developer/Xcode/DerivedData/〔プロジェクト〕/Build/Products/Release-iphoneos/SubBuddy.app/PlugIns/MonitorExtension.appex
```

> ✅ 本体アプリと Monitor 拡張の両方で、出力に `com.apple.developer.family-controls` と `com.apple.security.application-groups` が含まれることを確認する。
> ⚠ 出力に無い場合は、手順4〜8を直してから Archive し直す。

## 14. この手順書の後に残る作業

○ 目的：この手順書だけではリリース完了ではないことを確認する。

□ 操作

1. Xcode Organizer から Archive を App Store Connect へアップロードする。
2. App Store Connect でビルド処理が完了するのを待つ。
3. TestFlight で内部テスト、必要なら外部テストを行う。
4. 対象バージョンに提出ビルドを紐づける。
5. スクリーンショット、審査情報、輸出コンプライアンス、年齢制限など未入力項目を埋める。
6. `Submit for Review` で Apple に審査提出する。
7. Apple の審査に通った後、手動リリースまたは自動リリース設定に従って公開する。

> ✅ この手順書の完了は「リリース準備完了」。実際の公開は、App Store Connect での審査提出とApple審査通過後に行う。

## 15. 公式URL

- App ID / Capability Requests の入口

```bash
https://developer.apple.com/account/resources/identifiers/list
```

- Capability Requests の公式手順

```bash
https://developer.apple.com/help/account/capabilities/capability-requests
```

- iOS supported capabilities

```bash
https://developer.apple.com/help/account/reference/supported-capabilities-ios/
```

- 配布プロファイル作成の説明

```bash
https://developer.apple.com/help/account/manage-profiles/create-a-distribution-provisioning-profile
```

- Certificates 一覧

```bash
https://developer.apple.com/account/resources/certificates/list
```

- Certificates overview

```bash
https://developer.apple.com/help/account/certificates/certificates-overview
```

- CSR 作成の説明

```bash
https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request
```

- Family Controls entitlement の説明

```bash
https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.family-controls
```

- Family Controls entitlement 申請の説明

```bash
https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement
```

- App Store Connect

```bash
https://appstoreconnect.apple.com/apps
```

- App Privacy の説明

```bash
https://developer.apple.com/app-store/app-privacy-details/
```
