# Apple サインイン準備手順（運用者向け）

> 対象: SubBuddy の Apple サインインを使うために、Apple Developer / App Store Connect 上で手作業で準備する人。
> 本書は手動作業だけを扱う。実装、コード修正、環境変数設定は扱わない。

---

## 目的

SubBuddy の `cloud-testflight mode` で Apple サインインを使えるようにするため、Apple 側で次を準備する。

- iOS アプリ用の App ID（＝アプリを識別する登録）
- Sign in with Apple capability（＝Apple サインインを使う許可）
- Web ログイン用の Services ID（＝Web/API 側のログイン識別子）
- Return URL（＝Apple ログイン後に戻るURL）
- Sign in with Apple private key（＝サーバーが Apple と通信するための秘密鍵）

---

## 前提

- Apple Developer Program に加入済みである。
- Apple Developer の Account Holder または Admin 権限で作業できる。
- SubBuddy の本番または検証用ドメインが決まっている。
- Callback URL が決まっている。

例:

```text
https://<SubBuddyのドメイン>/api/auth/apple/callback
```

> ⚠ 実際の Team ID、Key ID、秘密鍵、メールアドレス、ドメイン名はこの手順書に書き込まない。別の安全な場所で管理する。

---

## 作業で控える値

作業後、実装担当者に次の値を渡す。

| 項目 | 説明 | 例 |
|---|---|---|
| Team ID | Apple Developer Team のID | `<TEAM_ID>` |
| Bundle ID | iOS アプリの識別子 | `com.example.subbuddy` |
| Services ID | Webログイン用の識別子 | `com.example.subbuddy.web` |
| Key ID | Sign in with Apple private key のID | `<KEY_ID>` |
| Private key file | ダウンロードした `.p8` ファイル | `AuthKey_<KEY_ID>.p8` |
| Return URL | Apple ログイン後に戻るURL | `https://<domain>/api/auth/apple/callback` |

> ⚠ `.p8` ファイルの中身をチャット、メール本文、GitHub、Notion、Slack の通常チャンネルに貼らない。

---

## 1. Apple Developer Program の状態を確認する

**○ 目的**
Apple サインインと TestFlight 配布に必要な Apple Developer Program の状態を確認する。

**□ 操作**

1. ブラウザで [Apple Developer](https://developer.apple.com/account/) を開く。
2. Apple ID でサインインする。
3. 画面上で Team を選ぶ。
4. Account Holder または Admin 権限があることを確認する。
5. Apple Developer Program が有効であることを確認する。

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
   - 例: `com.example.subbuddy`
9. Capabilities の一覧で `Sign in with Apple` にチェックを入れる。
10. 内容を確認して登録する。

> ⚠ Bundle ID は後で iOS アプリ側の設定と一致させる。途中で変えると手戻りが大きい。

> ✅ Identifiers の一覧に iOS アプリ用 App ID が表示され、Sign in with Apple が有効になっている。

---

## 3. App ID の Sign in with Apple 設定を確認する

**○ 目的**
Apple サインインの基点になる App ID を確認する。

**□ 操作**

1. `Identifiers` 一覧で、作成した iOS アプリ用 App ID を開く。
2. `Sign in with Apple` が有効になっていることを確認する。
3. 必要なら `Configure` を開き、primary App ID として扱える状態になっていることを確認する。
4. 保存する。

> ✅ iOS アプリ用 App ID に Sign in with Apple が付いている。

---

## 4. Webログイン用 Services ID を作る

**○ 目的**
SubBuddy の Web/API 側で Apple サインインを受けられるようにする。

**□ 操作**

1. `Identifiers` 一覧に戻る。
2. `+` を押す。
3. `Services IDs` を選ぶ。
4. `Description` に分かりやすい名前を入れる。
   - 例: `SubBuddy Web Login`
5. `Identifier` に Web ログイン用のIDを入れる。
   - 例: `com.example.subbuddy.web`
6. 登録する。
7. 作成した Services ID を開く。
8. `Sign in with Apple` にチェックを入れる。
9. `Configure` を開く。
10. `Primary App ID` に、手順2で作った iOS アプリ用 App ID を選ぶ。
11. `Domains and Subdomains` に SubBuddy のドメインを入れる。
    - 例: `<SubBuddyのドメイン>`
12. `Return URLs` に Callback URL を入れる。
    - 例: `https://<SubBuddyのドメイン>/api/auth/apple/callback`
13. 保存する。

> ⚠ Return URL は、実装側の Callback URL と完全一致させる。末尾の `/` の有無も別URLとして扱われる。

> ✅ Services ID に Sign in with Apple が有効になり、Domain と Return URL が登録されている。

---

## 5. Sign in with Apple private key を作る

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

## 6. Team ID を確認する

**○ 目的**
実装側で必要になる Team ID を控える。

**□ 操作**

1. Apple Developer Account の Membership または Team 情報を開く。
2. Team ID を確認する。
3. Team ID を控える。

> ✅ Team ID、Key ID、Services ID、Bundle ID、Return URL が揃っている。

---

## 7. Private Email Relay を使うか決める

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

## 8. 実装担当者へ渡す

**○ 目的**
Apple 側の準備結果を、実装に必要な情報だけに絞って渡す。

**□ 操作**

1. 次の項目を安全な方法で実装担当者へ共有する。

```text
Team ID: <TEAM_ID>
Bundle ID: <BUNDLE_ID>
Services ID: <SERVICES_ID>
Key ID: <KEY_ID>
Private key file: <AuthKey_KEYID.p8 の安全な保管場所>
Return URL: <RETURN_URL>
```

2. `.p8` ファイルそのものは、通常のチャットや Git では渡さない。
3. 実装担当者と、秘密情報を置く場所を確認する。

> ✅ 実装担当者が Team ID / Bundle ID / Services ID / Key ID / Return URL を把握し、private key の安全な受け渡し方法も決まっている。

---

## 9. 作業完了チェック

- [ ] Apple Developer Program が有効
- [ ] iOS アプリ用 App ID を作成済み
- [ ] App ID で Sign in with Apple を有効化済み
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
