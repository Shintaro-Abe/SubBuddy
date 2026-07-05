# Apple サインイン準備手順（運用者向け）

> 対象: SubBuddy の Apple サインインを使うために、Apple Developer / App Store Connect 上で手作業で準備する人。
> 本書は手動作業だけを扱う。実装、コード修正、環境変数設定は扱わない。

---

## 目的

SubBuddy の `cloud-testflight mode` で Apple サインインを使えるようにするため、Apple 側で次を準備する。

- iOS アプリ用の App ID（＝アプリを識別する登録）
- DeviceActivityMonitor Extension 用の App ID（＝使用時間を裏で受け取る拡張の登録）
- App Group（＝本体アプリと拡張が安全にデータを受け渡す共有領域）
- Sign in with Apple capability（＝Apple サインインを使う許可）
- Web ログイン用の Services ID（＝Web/API 側のログイン識別子）
- Return URL（＝Apple ログイン後に戻るURL）
- Sign in with Apple private key（＝サーバーが Apple と通信するための秘密鍵）

---

## 前提

- Apple Developer Program に加入済みである。
- 登録タイプは `Individual`（個人）または `Organization`（組織）である。
- 個人登録の場合、自分が Account Holder である。組織登録の場合、Account Holder または Admin 権限で作業できる。
- SubBuddy のドメインとして `sub-buddy.com` を使う。
- Webアプリ/API 用ホストとして `app.sub-buddy.com` を使う。
- Callback URL は `https://app.sub-buddy.com/api/auth/apple/callback` を使う。

ドメインの使い分け:

| 用途 | URL |
|---|---|
| サービス紹介・LP | `https://sub-buddy.com` |
| Webアプリ/API | `https://app.sub-buddy.com` |
| Apple Callback URL | `https://app.sub-buddy.com/api/auth/apple/callback` |

> ⚠ 実際の Team ID、Key ID、秘密鍵、メールアドレス、ドメイン名はこの手順書に書き込まない。別の安全な場所で管理する。

---

## 作業で控える値

作業後、実装担当者に次の値を渡す。

| 項目 | 説明 | 例 |
|---|---|---|
| Team ID | Apple Developer Team のID。個人登録でも自分個人の Team ID がある | `<TEAM_ID>` |
| iOS App Bundle ID | iOS アプリ本体の識別子 | `com.subbuddy.app` |
| Monitor Extension Bundle ID | DeviceActivityMonitor Extension の識別子 | `com.subbuddy.app.monitor` |
| App Group ID | 本体アプリと Extension の共有領域 | `group.com.subbuddy.app` |
| Services ID | Webログイン用の識別子 | `com.subbuddy.web` |
| Key ID | Sign in with Apple private key のID | `<KEY_ID>` |
| Private key file | ダウンロードした `.p8` ファイル | `AuthKey_<KEY_ID>.p8` |
| Domain and Subdomains | Apple サインインを使う Web/API のホスト | `app.sub-buddy.com` |
| Return URL | Apple ログイン後に戻るURL | `https://app.sub-buddy.com/api/auth/apple/callback` |

> ⚠ `.p8` ファイルの中身をチャット、メール本文、GitHub、Notion、Slack の通常チャンネルに貼らない。

---

## 1. Apple Developer Program の状態を確認する

**○ 目的**
Apple サインインと TestFlight 配布に必要な Apple Developer Program の状態を確認する。

**□ 操作**

1. ブラウザで [Apple Developer](https://developer.apple.com/account/) を開く。
2. Apple ID でサインインする。
3. `Membership details` または `メンバーシップの詳細` を開く。
4. `Entity Type` を確認する。
   - 個人登録なら `Individual` と表示される。
   - 組織登録なら `Organization` と表示される。
5. 個人登録の場合、自分が Account Holder であることを確認する。
6. 組織登録の場合、Account Holder または Admin 権限があることを確認する。
7. Apple Developer Program が有効であることを確認する。

> ⚠ 個人登録では、画面上に Team の切り替え欄が出ないことがある。その場合は、自分個人の Team がすでに選ばれている状態として進める。

> ✅ Account 画面に入れて、Certificates, Identifiers & Profiles を開ければ次へ進める。

---

## 2. iOS アプリ用 App ID を作る

**○ 目的**
iPhone アプリを Apple 側に登録する。

**□ 操作**

1. Apple Developer の [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) を開く。
2. 左側または上部の `Identifiers` を開く。
3. `+` を押す。
4. `App IDs` を選ぶ。
5. `App` を選ぶ。
6. `Description` に分かりやすい名前を入れる。
   - 例: `SubBuddy iOS`
7. `Bundle ID` は `Explicit` を選ぶ。
8. Bundle ID を入力する。
   - 入力値: `com.subbuddy.app`
9. Capabilities の一覧で `Sign in with Apple` にチェックを入れる。
10. 内容を確認して登録する。

> ⚠ Bundle ID は後で iOS アプリ側の設定と一致させる。途中で変えると手戻りが大きい。

> ⚠ `App Groups` と `Family Controls` は手順4〜5で必ず確認する。ここで `Sign in with Apple` だけを付けて終わりにしない。

> ✅ Identifiers の一覧に iOS アプリ用 App ID が表示され、Sign in with Apple が有効になっている。

---

## 3. DeviceActivityMonitor Extension 用 App ID を作る

**○ 目的**
使用時間の到達通知を受け取る Extension を Apple 側に登録する。

**□ 操作**

1. Apple Developer の [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) を開く。
2. `Identifiers` を開く。
3. `+` を押す。
4. `App IDs` を選ぶ。
5. `App` を選ぶ。
6. `Description` に分かりやすい名前を入れる。
   - 例: `SubBuddy Monitor Extension`
7. `Bundle ID` は `Explicit` を選ぶ。
8. Extension 用 Bundle ID を入力する。
   - 入力値: `com.subbuddy.app.monitor`
9. Capabilities の一覧では、`Sign in with Apple` にチェックを入れない。
10. 内容を確認して登録する。

> ⚠ Extension は本体アプリとは別の Bundle ID を持つ。TestFlight / App Store 配布では、本体アプリだけでなく Extension 側の App ID も必要になる。

> ⚠ `DeviceActivityMonitor` という名前の Capability はない。使用時間機能で見るのは `Family Controls` entitlement（＝使用時間関連機能の許可）である。

> ⚠ Family Controls の配布用 entitlement（＝配布で使用時間機能を使う許可）を申請する段階では、本体アプリと Extension の両方を対象にする。

> ✅ Identifiers の一覧に Extension 用 App ID が表示されている。

---

## 4. App Group を作る

**○ 目的**
本体アプリと DeviceActivityMonitor Extension が、同じ端末内で必要な情報を受け渡せるようにする。

**□ 操作**

1. Apple Developer の [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) を開く。
2. `Identifiers` を開く。
3. `+` を押す。
4. `App Groups` を選ぶ。
5. `Description` に分かりやすい名前を入れる。
   - 例: `SubBuddy App Group`
6. `Identifier` に App Group ID を入れる。
   - 入力値: `group.com.subbuddy.app`
7. 内容を確認して登録する。
8. 手順2で作った iOS アプリ用 App ID を開く。
9. `App Groups` を有効にし、作成した App Group にチェックを入れて保存する。
10. 手順3で作った Extension 用 App ID を開く。
11. `App Groups` を有効にし、同じ App Group にチェックを入れて保存する。

> ⚠ App Group は本体アプリと Extension の両方に付ける。片方だけだと共有領域を使えない。

> ✅ 本体アプリ用 App ID と Extension 用 App ID の両方で、同じ App Group が有効になっている。

---

## 5. App ID の Capability を確認する

**○ 目的**
本体アプリと Extension に必要な Capability（＝Apple が許可する機能）が付いているか確認する。

| 対象 | Apple Developer の App ID で確認するもの | 選ばないもの |
|---|---|---|
| iOS アプリ本体 | `Sign in with Apple` / `App Groups` / `Family Controls (development)` が表示される場合は有効化 | なし |
| DeviceActivityMonitor Extension | `App Groups` / `Family Controls (development)` が表示される場合は有効化 | `Sign in with Apple` |

> `Family Controls (development)` は開発用。TestFlight / App Store 配布には、別途 Family Controls の配布用 entitlement 承認が必要。通常の Capability チェックだけで配布できる状態にはならない。

**□ 操作**

1. `Identifiers` 一覧で、作成した iOS アプリ用 App ID を開く。
2. `Sign in with Apple` が有効になっていることを確認する。
3. `App Groups` が有効で、`group.com.subbuddy.app` が選ばれていることを確認する。
4. `Family Controls` または `Family Controls (development)` が表示されている場合は、有効にする。
5. 保存する。
6. `Identifiers` 一覧に戻り、DeviceActivityMonitor Extension 用 App ID を開く。
7. `Sign in with Apple` が有効になっていないことを確認する。
8. `App Groups` が有効で、`group.com.subbuddy.app` が選ばれていることを確認する。
9. `Family Controls` または `Family Controls (development)` が表示されている場合は、有効にする。
10. 保存する。

> ⚠ `Family Controls` が表示されない、または配布用が有効にできない場合でも、ここで止めない。配布用 entitlement は Apple への申請と承認が必要。申請後に、本体アプリと Extension の両方で有効になったことを確認する。

> ✅ 本体アプリには `Sign in with Apple` / `App Groups`、Extension には `App Groups` が付いている。`Family Controls (development)` が表示される場合は両方で有効。Extension に `Sign in with Apple` は付いていない。

---

## 6. 申請後に Capability 不足へ気づいた場合

**○ 目的**
Family Controls の申請後に App ID の Capability 不足へ気づいた場合、実際にできる範囲で状態を直す。

**□ 操作**

1. Apple Developer の [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) を開く。
2. iOS アプリ用 App ID を開く。
3. `Sign in with Apple` が有効になっていることを確認する。
4. `App Groups` を有効にし、`group.com.subbuddy.app` を選ぶ。
5. `Family Controls (development)` が表示されている場合は、有効にする。
6. 保存する。
7. DeviceActivityMonitor Extension 用 App ID を開く。
8. `App Groups` を有効にし、`group.com.subbuddy.app` を選ぶ。
9. `Family Controls (development)` が表示されている場合は、有効にする。
10. `Sign in with Apple` が有効になっていないことを確認する。
11. 保存する。
12. 申請がまだ審査中なら、追加連絡や重複再申請はせず、結果を待つ。
13. 却下された場合だけ、同じ Bundle ID のまま、本体アプリと Extension の両方を対象にして再申請する。

> ⚠ Bundle ID を変えない。Bundle ID を変えると別アプリ扱いになり、申請も取り直しになる。

> ⚠ 申請フォームに追記欄がない場合、申請内容への追記を前提にしない。重複申請も、どれが最新版か分からなくなるため避ける。

> ✅ 本体アプリと Extension の App ID 設定を直した。審査中なら結果待ち、却下済みなら同じ Bundle ID で再申請する準備ができている。

---

## 7. Webログイン用 Services ID を作る

**○ 目的**
SubBuddy の Web/API 側で Apple サインインを受けられるようにする。

**□ 操作**

1. `Identifiers` 一覧に戻る。
2. `+` を押す。
3. `Services IDs` を選ぶ。
4. `Description` に分かりやすい名前を入れる。
   - 例: `SubBuddy Web Login`
5. `Identifier` に Web ログイン用のIDを入れる。
   - 例: `com.subbuddy.web`
6. 登録する。
7. 作成した Services ID を開く。
8. `Sign in with Apple` にチェックを入れる。
9. `Configure` を開く。
10. `Primary App ID` に、手順2で作った iOS アプリ用 App ID を選ぶ。
11. `Domains and Subdomains` に Webアプリ/API 用ホストを入れる。
    - 入力値: `app.sub-buddy.com`
12. `Return URLs` に Callback URL を入れる。
    - 入力値: `https://app.sub-buddy.com/api/auth/apple/callback`
13. 保存する。

> ⚠ Return URL は、実装側の Callback URL と完全一致させる。末尾の `/` の有無も別URLとして扱われる。

> ⚠ `sub-buddy.com` はサービス紹介・LP用に残す。Apple サインインの Domain / Return URL には、Webアプリ/API 用の `app.sub-buddy.com` を使う。

> ✅ Services ID に Sign in with Apple が有効になり、Domain と Return URL が登録されている。

---

## 8. Sign in with Apple private key を作る

**○ 目的**
SubBuddy のサーバーが Apple と安全に通信するための秘密鍵を作る。

**□ 操作**

1. Apple Developer の [Keys](https://developer.apple.com/account/resources/authkeys/list) を開く。
2. `+` を押す。
3. `Key Name` に分かりやすい名前を入れる。
   - 例: `SubBuddy Sign in with Apple Key`
4. `Sign in with Apple` にチェックを入れる。
5. `Configure` を開く。
6. Primary App ID に、手順2で作った iOS アプリ用 App ID を選ぶ。
7. 保存する。
8. 内容を確認して Key を作成する。
9. 表示された Key ID を控える。
10. `.p8` private key ファイルをダウンロードする。
11. ダウンロードした `.p8` ファイルを安全な場所に保管する。

> ⚠ `.p8` ファイルは再ダウンロードできない。なくした場合は新しい Key を作り直す。

> ⚠ `.p8` ファイルをリポジトリ、`.env`、共有ドキュメントに貼らない。安全なパスワード管理ツールや秘密情報管理場所に保管する。

> ✅ Key ID と `.p8` ファイルが手元にあり、安全な場所に保管されている。

---

## 9. Team ID を確認する

**○ 目的**
実装側で必要になる Team ID を控える。

**□ 操作**

1. Apple Developer Account の `Membership details` または `メンバーシップの詳細` を開く。
2. `Team ID` を確認する。
3. `Team Name` を確認する。
   - 個人登録の場合、Team Name は自分の氏名または個人名になる。
   - 組織登録の場合、Team Name は組織名になる。
4. `Role` を確認する。
   - 個人登録の場合、通常は `Account Holder`。
5. Team ID を控える。

> ⚠ Xcode に表示される `Personal Team` は無料開発用の簡易 Team。TestFlight 配布や配布用の申請では、Apple Developer Program の Team ID を使う。

> Apple Developer 画面で Team ID が見つからない場合は、Xcode の `Settings...` → `Accounts` → Apple ID → `Team` 一覧でも確認できる。

> ✅ Team ID、Key ID、Services ID、iOS App Bundle ID、Monitor Extension Bundle ID、App Group ID、Return URL が揃っている。

---

## 10. Private Email Relay を使うか決める

**○ 目的**
ユーザーが「メールを非公開」を選んだ場合に、SubBuddy からメールを送るか決める。

**□ 操作**

1. SubBuddy からユーザーへメール通知を送る予定があるか確認する。
2. 初期の小規模検証版でメールを送らないなら、この手順は後回しにする。
3. メールを送るなら、Apple Developer の Private Email Relay 設定で送信元ドメインまたはメールアドレスを登録する。
4. 必要な DNS の SPF 設定を行う。

> ⚠ 初期版でメール通知を使わないなら、無理に設定しない。使う段階で設定する。

> ✅ メール送信を使うかどうかが決まっている。使う場合は送信元登録と DNS 設定が済んでいる。

---

## 11. 実装担当者へ渡す

**○ 目的**
Apple 側の準備結果を、実装に必要な情報だけに絞って渡す。

**□ 操作**

1. 次の項目を安全な方法で実装担当者へ共有する。

```text
Team ID: <TEAM_ID>
iOS App Bundle ID: <IOS_APP_BUNDLE_ID>
Monitor Extension Bundle ID: <MONITOR_EXTENSION_BUNDLE_ID>
App Group ID: <APP_GROUP_ID>
Services ID: <SERVICES_ID>
Key ID: <KEY_ID>
Private key file: <AuthKey_KEYID.p8 の安全な保管場所>
Return URL: <RETURN_URL>
```

2. `.p8` ファイルそのものは、通常のチャットや Git では渡さない。
3. 実装担当者と、秘密情報を置く場所を確認する。

> ✅ 実装担当者が Team ID / iOS App Bundle ID / Monitor Extension Bundle ID / App Group ID / Services ID / Key ID / Return URL を把握し、private key の安全な受け渡し方法も決まっている。

---

## 12. 作業完了チェック

- [ ] Apple Developer Program が有効
- [ ] iOS アプリ用 App ID を作成済み
- [ ] DeviceActivityMonitor Extension 用 App ID を作成済み
- [ ] App Group を作成済み
- [ ] 本体アプリ用 App ID に App Group を有効化済み
- [ ] Extension 用 App ID に App Group を有効化済み
- [ ] 本体アプリ用 App ID で Sign in with Apple を有効化済み
- [ ] Extension 用 App ID では Sign in with Apple を有効化していない
- [ ] `Family Controls (development)` が表示される場合、本体アプリ用 App ID で有効化済み
- [ ] `Family Controls (development)` が表示される場合、Extension 用 App ID で有効化済み
- [ ] Family Controls 配布用 entitlement 申請で、本体アプリと Extension の両方を対象にした
- [ ] Family Controls 申請後に Capability 不足へ気づいた場合、App ID 設定を修正済み。審査中なら結果待ち、却下済みなら同じ Bundle ID で再申請する
- [ ] Services ID を作成済み
- [ ] Services ID に Domain と Return URL を登録済み
- [ ] Sign in with Apple private key を作成済み
- [ ] Key ID を控えた
- [ ] `.p8` ファイルを安全な場所に保管した
- [ ] Team ID を控えた
- [ ] 実装担当者へ渡す値が揃った
- [ ] `.p8` や実シークレットを Git / docs / チャット本文に貼っていない

---

## 参考リンク

- [Apple Developer Program](https://developer.apple.com/programs/)
- [Apple Developer Account: Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/)
- [Apple Developer Account: About Sign in with Apple](https://developer.apple.com/help/account/capabilities/about-sign-in-with-apple/)
- [Apple Developer Account: Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- [Apple Developer Account: Create a Sign in with Apple private key](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/)
- [Apple Developer Account: Configure private email relay service](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)
- [Apple Developer Account: Register an app group](https://developer.apple.com/help/account/identifiers/register-an-app-group/)
- [Apple Developer Account: Supported capabilities (iOS)](https://developer.apple.com/help/account/reference/supported-capabilities-ios/)
