# 段階7：配布のための申請手順書（MUST-9：配布できる見込み）

> 置き場所：`.steering/20260606-ios-screen-time-spike/`
> 作成日：2026-06-16
> 担当：Claude Code（プライバシー／配布まわりの担当として整理）
> この文書の役割：iPhone アプリ（SubBuddy）を App Store または TestFlight で配るときに必要な
> 「Apple への許可申請」「プライバシー説明ファイルの作成」「App Store のプライバシー表示の登録」を、
> **上から順にこのとおり進めれば作業できる**手順書としてまとめたもの。
> 配ること自体は後回し（ポストMVP）だが、手順と中身を先に固めておく（要求 A3）。

---

> ## ⚠️ この手順書がいつ必要か（先に読む）
>
> **この手順書（手順A・B・C）が必要なのは「アプリを他人に配るとき」だけ。**
> App Store や TestFlight で配布する場合に、Apple への申請・申告として必要になる。
>
> **自分の iPhone に Xcode から入れて自分だけで使う（ローカルファースト）なら、手順A・B・C はどれも不要。**
> その場合に要るのは「開発用の許可（自分で Xcode で付けられる。Apple の審査なし）」だけで、
> これは Spike の段階0〜2で設定・実証済み。
>
> Family Controls（使用時間のしくみ）の許可には2種類ある。
>
> | 許可の種類 | 取り方 | いつ必要か |
> |---|---|---|
> | 開発用（development） | 自分で Xcode で付ける（審査なし） | 自分の端末で動かすだけならこれで足りる |
> | 配布用（distribution） | Apple にフォーム申請して承認をもらう | App Store / TestFlight で他人に配るとき＝この手順書 |
>
> **現在の方針：まずローカルファーストで構築する（2026-06-16 確認）。**
> したがって当面この手順書の作業は発生しない。将来、他人に配る判断をしたときに、この手順書をそのまま使う。

---

> ## 早期申請の判断と発火条件（配布を視野に入れる場合）
>
> 配布用の許可は**承認まで数日〜1か月以上**かかる報告がある。そのため「将来配るかもしれない」なら、
> **MVP の完成を待たず早めに申請を出しておく**のは妥当（欲張りではない）。ただし**今すぐ・Spike のままでは出さない**。
> 出すのが早すぎる／対象が使い捨てだと、却下や取り直しになって、節約したい時間をかえって失う。
>
> **なぜ「今すぐ」がダメか（確認済みの事実）**
>
> - 申請は **最終的な Bundle ID（アプリを識別する文字列）に紐づく**。Bundle ID を変える／チームを移すと**再申請**になる。
>   いまの Spike は使い捨ての ID（`com.subbuddy.SubBuddySpike`）なので、これで取った承認は製品版で無駄になりやすい。
> - 申請には **App Store Connect にアプリ登録が必要**（申請に使う App Apple ID を取るため）。
>   **ビルドのアップロードは不要**だが、**スクショ・プライバシーポリシー・アプリ説明・対象年齢は埋める**必要がある。
>   これらが空＝「アプリが準備できていない」として**却下**される報告がある。
>
> **申請してよい発火条件（この3つが揃ったら出す。MVP 完成は不要）**
>
> 1. `apps/ios/` を作り、**製品版の最終 Bundle ID を確定・登録**する（本体＋拡張の2つ）。＝最重要。ここが固まるまで申請しない。
> 2. App Store Connect にアプリを登録し、**スクショ・プライバシーポリシー・説明・年齢を入力**する
>    （ポリシー文は本書 手順C-3 がそのまま使える。ビルドは不要なので、見せられる画面が数枚あれば足りる）。
> 3. 上記がそろったら、**本体・拡張の2件を申請**（手順A）。承認待ちの期間は**ローカルファースト開発を並行**で進める。
>
> 補足：申請しても配布を強制されるわけではなく、承認は取得したまま置いておける。時間切れ（期限失効）の明確な記述は見当たらず、
> 承認が失われる主因は **Bundle ID の変更・チーム移管**。だから「最終 Bundle ID を先に確定する」ことが早期申請の鍵。

---

## 0. まず結論

**「配れる見込みはある」。** いちばんの不安だった「子どもの見守り（ペアレンタルコントロール）ではなく、
"本人が自分の使用時間を見てサブスクを節約判断する" 用途で、Apple が許可を出すか」については、
**同じく個人利用の使用時間アプリが、配布用の許可を実際に取得した前例**を確認できた。
本アプリは「本人の端末・本人の許可・集計した数字だけを本人の Mac に送る・第三者には何も送らない」という作りなので、
その前例よりも説明しやすい。

ただし、**最終的に許可が下りるかは、実際に申請して Apple の返事を見るまで確定しない。**
許可までは数日〜数週間（場合によっては1か月以上）かかる報告がある。**配ると決めたら、まずこの申請を最優先で出す。**

この手順書でやることは大きく3つ。

| 手順 | 何をするか | いつやるか |
|---|---|---|
| 手順A | Apple に「使用時間のしくみを配布で使う許可」を申請する | 配布を決めたら最初に。承認に時間がかかるため |
| 手順B | アプリに「プライバシー説明ファイル」を入れる | アプリを提出用にビルドする前まで |
| 手順C | App Store の「プライバシー表示」を登録する | App Store Connect での提出準備時 |

---

## 1. 事前に用意するもの（チェックリスト）

申請を始める前に、次がそろっているか確認する。

- [ ] **Apple Developer Program（有料）に加入している**（年会費のメンバーシップ。Spike の段階0で確認済み）。
- [ ] **アプリの説明文**（このアプリが何をするものか、数行〜十数行）。
- [ ] **アプリのスクリーンショット**（主要画面が分かるもの。試作のものでよい）。
- [ ] **プライバシーポリシーの文章とその公開 URL**（後述の文案を使ってよい。GitHub の README などでも可）。
- [ ] **アプリの対象年齢の想定**（年齢区分。一般向けとして問題ない作り）。
- [ ] **アプリの公式ページの URL**（なければ GitHub のリポジトリページでも可）。
- [ ] **本体アプリと拡張、それぞれの Bundle ID（＝アプリを識別する文字列）**
  - 本体：`com.subbuddy.SubBuddySpike`（製品版では本番の ID に置き換える）
  - 拡張：`com.subbuddy.SubBuddySpike.MonitorExtension`（同上）

> メモ：Apple の申請フォームでは、上の「説明文・スクショ・プライバシーポリシー・年齢」を求められる。
> これらは App Store Connect（＝Apple にアプリを登録・提出する管理サイト）側でも使うので、先に作っておくと二度手間にならない。

---

## 手順A：配布用の許可（Family Controls）を申請する

> Family Controls（＝iOS で使用時間を測るしくみ）を**配布で使う**には、開発用とは別に、
> Apple へ専用フォームで申請して承認をもらう必要がある。開発・実機検証で使う許可（開発用）は自分で付けられるが、
> App Store・TestFlight の配布には**この配布用の承認が必須**。

### A-1. 申請の前に（素材をそろえる）

1. 上の「1. 事前に用意するもの」を埋める。
2. プライバシーポリシーを公開し、その **URL を控える**（手順C-3 の文案をそのまま使ってよい）。

### A-2. 申請フォームの場所

1. Web ブラウザで Apple Developer アカウントにログインする。
2. 次のフォームを開く（ログイン必須）：
   **`https://developer.apple.com/contact/request/family-controls-distribution`**
3. フォームは「開発者情報」と「アプリの情報（このアプリが許可をどう使うか）」に分かれている。
   開発者情報・アプリ名・公式ページ URL・アプリ説明・スクショ・プライバシーポリシー・想定年齢などを入力する。

### A-3. 「許可をどう使うか」の記入内容

**記入の方針（日本語）**：次の4点を、矛盾なく一貫して書く。

1. **誰の・何を測るか**：本人の端末で、本人が選んだ1つのアプリの使用時間だけを、本人の許可で測る。
   他人（子どもなど）を監視する機能はない。
2. **何のために使うか**：サブスクに対応づけたアプリを「最近どれくらい使っているか」をざっくり把握し、
   「払い続ける価値があるか」を**ユーザー自身が判断する材料**にする（解約・継続の意思決定の支援）。
3. **どこまで細かく見るか**：詳しい利用ログは扱わない。「その日◯分以上使った」という**到達の合図だけ**を受け取り、
   段階化した集計値（例：「120分以上」）にする。アプリ名そのものは端末の外に出さない。
4. **どこへ送るか**：集計値は、同じネットワーク上にある**本人の Mac にだけ**送る。
   **開発者のサーバーには送らない／第三者と共有しない／広告に使わない／追跡しない。**

**フォーム記入用の英文（そのまま貼れる叩き台）**：Apple の申請フォームは英語で書くのが無難。下を起点にする。

```
App name / purpose
SubBuddy is a personal subscription-management app. It helps a single user decide whether their own
subscriptions are still worth paying for. Family Controls is used only with individual authorization
(.individual), so the user measures their own app usage on their own device. The app has no
parental-control or child-supervision features.

How the entitlement is used
The user maps one subscription to one app and authorizes monitoring of that single app. We register
DeviceActivityEvent thresholds and respond to eventDidReachThreshold inside a DeviceActivityMonitor
extension to derive a coarse, bucketed daily-usage signal (for example, "used 120+ minutes today").
We do not use DeviceActivityReport to read or export detailed activity. Application tokens never leave
the device; only the coarse aggregated buckets do.

Data handling
The aggregated usage buckets are sent only to the user's own computer on their local network, to be
shown back to the same user. No data is sent to our servers, shared with third parties, used for
advertising, or used for tracking. This is a privacy-preserving, savings-oriented use of the Screen
Time API, not a monitoring product.
```

> 提出直前に、App Store Connect 側のアプリ説明・スクショ・プライバシーポリシーと**表現を合わせてから**出す
> （内容がそろっているほど承認されやすい）。

### A-4. 本体と拡張の「2件」を申請する（重要）

- 申請は **Bundle ID ごとに1件**。本アプリは「本体アプリ」と「使用時間を測る拡張（DeviceActivityMonitor）」の
  2つの Bundle ID を持つので、**同じ内容で2件**出す。
- **拡張ぶんを出し忘れると、拡張だけ配布許可が下りず、アプリ全体が出せなくなる**事故が報告されている。
  最初から本体・拡張の**両方を同時に**申請する。

### A-5. 申請したあと

1. 承認はメールで届く。**数日〜数週間**かかることがある（1か月以上の報告もある）。
2. 承認後、Apple Developer のサイトの **Certificates, Identifiers & Profiles** で、
   本体・拡張それぞれの App ID に **Family Controls（Distribution）** が有効になっているか確認する。
3. ごくまれに「承認メールは来たのにサイト表示が "Submitted" のまま」という不具合報告がある。
   その場合は提出に進めないので、**Apple のサポートに問い合わせる**。

---

## 手順B：プライバシー説明ファイル（PrivacyInfo.xcprivacy）を入れる

> プライバシー説明ファイル（＝アプリが「どんな情報を集めるか」「理由の申告が要る API をなぜ使うか」を
> Apple に申告する設定ファイル）。**2024年5月1日以降、これが無いアプリは App Store Connect が受け付けない。**

### B-1. このアプリで申告が必要なもの（確認済み）

Spike の実際のコードを確認した結果、**理由の申告が要る API は「UserDefaults」だけ**だった。

- **UserDefaults**（本体と拡張が App Group〔＝両者がデータを受け渡す共有の保管場所〕でデータを渡すのに使用）
  → カテゴリ `NSPrivacyAccessedAPICategoryUserDefaults`／理由コード **`CA92.1`**（アプリ自身の設定・状態の読み書き）。

> 補足：共有ファイルの受け渡しは「ファイルの中身の読み書き」だけで、ファイルの作成日時・更新日時を読む API は
> 使っていない（`SharedStore.swift` で確認）。そのため**ファイル日時の申告（`C617.1`）は不要**。
> 製品版で日時を読む処理を足したら、その時に `C617.1` を追加する。

集めるデータは「使用時間を段階化した集計値」。**本人に紐づくデータ**として申告し、**追跡には使わない**。

### B-2. Xcode でファイルを追加する操作

ファイルは**本体ターゲットと拡張ターゲットの両方**に入れる（どちらも UserDefaults を使うため）。

1. Xcode で `File ＞ New ＞ File…` を選ぶ。
2. 一覧の **Resource** の中の **App Privacy File** を選び、`Next`。
3. **Targets** の一覧で、入れる対象ターゲットにチェックを入れて `Create`。
   - まず**本体アプリのターゲット**にチェックして作る。
   - 同じ手順で、もう一度**拡張のターゲット**にもチェックして作る（合計2ファイル）。
4. ファイル名は **`PrivacyInfo.xcprivacy` のまま変えない**（この名前でないと認識されない）。
5. 作ったファイルを開き、下の XML に置き換える（または同じ内容を GUI で入力する）。

### B-3. 本体アプリ用の中身

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 追跡（トラッキング）はしない -->
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>

    <!-- 集めるデータ：使用時間の集計値。本人に紐づく／追跡に使わない／用途はアプリの機能 -->
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

    <!-- 理由の申告が要る API：UserDefaults だけ -->
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

### B-4. 拡張用の中身

拡張は「集計値を作って共有の保管場所に書く」側で、端末の外への送信は本体が行う。
そのため、集めるデータの申告は本体に寄せ、拡張側は API の申告（UserDefaults）を最小限に持つ。

```xml
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

> データ種別に選んだ `ProductInteraction`（＝製品とのやり取り＝使用状況）は、「使用時間」に最も近い分類。
> 製品版で確定するときは、App Store Connect の「Appのプライバシー」の設問の表現と突き合わせて最終決定する。

### B-5. 入れたあとの確認

- 提出用にビルドすると、Xcode が本体・拡張のプライバシー説明ファイルを**1つの「プライバシーレポート」にまとめる**。
  これが App Store の「プライバシー表示」のもとになる。
- Xcode の Organizer から、アーカイブ（提出用ビルド）の **Generate Privacy Report** でレポートを出し、
  申告内容（UserDefaults／使用状況データ）が想定どおりか目視で確認する。

---

## 手順C：App Store のプライバシー表示を登録する

> App Store の商品ページに出る「プライバシー表示」（＝このアプリが何を集めるかを示す表示）を、
> App Store Connect の設問に答えて登録する。手順Bの申告内容と矛盾しないようにそろえる。

### C-1. 操作の流れ

1. App Store Connect で対象アプリを開く。
2. 左メニューの **「Appのプライバシー」**（App Privacy）を開き、編集を始める。
3. 「データを収集していますか？」に **「はい」** と答える。
4. 集めるデータの種類として **「使用状況データ（Usage Data）」** を選ぶ。
5. その使用状況データについて、次のとおり答える。
   - **用途**：アプリの機能（App Functionality）だけ。分析・広告・第三者共有は選ばない。
   - **本人に紐づくか**：はい（紐づく）。
   - **追跡に使うか**：いいえ（使わない）。
6. 保存して公開する。

### C-2. 登録内容（早見表）

| 区分 | このアプリの申告 |
|---|---|
| 追跡に使うデータ | **なし**（第三者データとの突き合わせ・広告なし） |
| 本人に紐づくデータ | **使用状況データ（使用時間の集計値）**。用途はアプリ機能だけ |
| 本人に紐づかないデータ | なし |

### C-3. プライバシーポリシーの文（そのまま使える文案）

> 本アプリは、あなたが選んだアプリの使用時間を、あなたの iPhone の中で段階化した集計値にし、
> あなた自身の Mac にだけ送ります。アプリ名や細かい使用ログを、当社や第三者へ送ることはありません。
> 広告や追跡には一切利用しません。

### C-4. 「収集していない（Data Not Collected）」と申告できないか

集計値は、開発者のサーバーではなく**本人の Mac にだけ**送る。そのため「開発者は受け取らない＝収集していない」と
申告できる余地も理屈上はある。ただし Apple の「収集」の定義は、端末の外へ送って保持する行為を広めに含み、
解釈が分かれる領域。**安全側に倒して「使用状況データを本人に紐づくデータとして集める／用途はアプリ機能／追跡なし」と
申告する**ことを勧める（過少申告による却下・やり直しを避けるため）。「収集していない」での申告にしたい場合は、
提出直前に Apple の最新の案内で必ず確認してから決める。

---

## つまずきやすい点（先回りメモ）

1. **拡張の申請忘れ**：配布用の許可は本体・拡張の**両方**を申請する。片方だけだと配布できない。
2. **TestFlight も配布用の許可が要る**：身内テスト配布でも、開発用の許可では不可。配布用の承認が要る。
3. **プライバシー説明ファイルは両ターゲットに**：本体だけでなく拡張にも `PrivacyInfo.xcprivacy` を入れる。
   ファイル名は変えない。
4. **承認は時間がかかる**：配ると決めたら最優先で申請する。提出直前に慌てて出すと間に合わない。
5. **承認後の表示不具合**：承認メールが来てもサイト表示が「Submitted」のまま提出に進めない事例がある。
   その時はサポートに連絡する。

---

## 残課題・出典

### 「確定」と「見込み」の切り分け

- **確定していること**：理由の申告が要る API は UserDefaults（`CA92.1`）だけ。申請は Bundle ID ごと（本体＋拡張で2件）。
  プライバシー表示は「使用状況データ・本人に紐づく・追跡なし・用途はアプリ機能」。
- **見込みにとどまること**：配布許可が最終的に下りるかは、**実際に申請して Apple の返事を見るまで確定しない**。
  配布フェーズで実際に申請して確認するまで、MUST-9 は「見込みあり」の状態。

### 製品版（`apps/ios/`）への申し送り

1. 配布を決めたら、配布用の許可を**本体＋拡張の2件、同時に**、早めに申請する。
2. 本体・拡張それぞれに `PrivacyInfo.xcprivacy` を入れる（上の XML を起点に）。日時を読む処理を足したら `C617.1` を追加。
3. App Store Connect の「Appのプライバシー」で、上の早見表どおりに登録する。表現を申請文・ポリシーとそろえる。
4. 「収集していない」と申告できるかは、提出直前に Apple の最新案内で確認してから最終決定する。

### 出典（Apple 公式を優先。取得日 2026-06-16）

- 配布用 Family Controls 許可の申請（Apple 公式）
  `https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement`
- Family Controls 許可の定義（Apple 公式）
  `https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.family-controls`
- 配布用許可の申請フォーム（Apple 公式・要ログイン）
  `https://developer.apple.com/contact/request/family-controls-distribution`
- Family Controls の設定（Apple 公式）
  `https://developer.apple.com/documentation/xcode/configuring-family-controls`
- 個人利用の使用時間アプリが配布許可を取得した実例・Bundle ID ごと1件・拡張も別申請（開発者ブログ）
  `https://medium.com/@itsuki.enjoy/swift-ios-take-family-control-to-production-distribution-83da9b3346c6`
- 配布許可フォームに関する開発者フォーラム（承認待ち期間の実情・表示不具合）
  `https://developer.apple.com/forums/thread/735888` ／ `https://developer.apple.com/forums/thread/820971`
- プライバシー説明ファイルの追加手順・複数ターゲットへの配置（Apple 公式／解説）
  `https://developer.apple.com/documentation/bundleresources/privacy-manifest-files` ／ `https://bugfender.com/blog/apple-privacy-requirements/`
- 理由の申告が要る API（UserDefaults＝`CA92.1`）の申告（解説）
  `https://capacitorjs.com/docs/v5/ios/privacy-manifest`
- App Store のプライバシー表示の区分（Apple 公式）
  `https://developer.apple.com/app-store/app-privacy-details/`
