# iOS Screen Time Spike — セットアップ手順

使い捨ての技術検証用プロジェクト。go 判定後は `apps/ios/` を正式新設し、本ディレクトリは破棄する。

---

## 前提条件

- [ ] Apple Developer Program（有料・年額 $99）に加入済み — https://developer.apple.com/programs/
  - 加入直後は PLA（Program License Agreement）への同意が必要。https://developer.apple.com/account で規約に同意する
  - **同意後、Apple 側のサーバーに反映されるまで数時間〜24時間かかることがある**。ブラウザで「Certificates, Identifiers & Profiles」セクションが表示されるまで待つ
- [ ] Xcode がインストールされた Mac（最新の安定版を推奨）
- [ ] iPhone 実機（iOS 16 以降）を USB で Mac に接続できる
- [ ] SubBuddy の Mac 側（`apps/web`）が LAN アクセス可能な状態で起動済み（後述の Step 7 参照）
- [ ] iPhone と Mac が同じ Wi-Fi ネットワークに接続している

---

## Step 1: Xcode プロジェクトの新規作成

1. Xcode を開く
2. メニューバー **File → New → Project...** を選択
3. テンプレート選択画面で：
   - 上部タブ：**iOS** を選択（macOS ではない）
   - テンプレート：**App** を選択
   - 「Next」を押す
4. プロジェクト設定画面で：
   - **Product Name**: `SubBuddySpike`
   - **Team**: 自分の Apple Developer アカウントを選択
   - **Organization Identifier**: 自分で決めてよい（例: `com.shintaroabe`、`com.subbuddy`）
   - **Bundle Identifier**: 自動で `com.xxx.SubBuddySpike` になる
   - **Interface**: **SwiftUI** を選択
   - **Language**: **Swift** を選択
   - **Storage**: 何も選択しない
   - **Other Components**: 何も選択しない
   - 「Next」を押す
5. 保存先を選ぶ（例: `~/Developer/SubBuddySpike/`）→「Create」を押す
6. Git の Author Name / Email を聞かれたら、GitHub で使っている名前とメールアドレスを入力する（コミット履歴用。動作には影響しない）

---

## Step 2: iPhone 実機の準備

1. iPhone を USB ケーブルで Mac に接続する
2. iPhone 側で「このコンピュータを信頼しますか？」と聞かれたら「信頼」をタップ
   - パスコードを求められたら **iPhone のロック解除パスコード**（普段 iPhone を開くときに入力する数字）を入力する
3. Xcode 上部ツールバーの **▶（Run ボタン）の右隣** にデバイス選択メニューがある（「スキーム名 > デバイス名」と表示されている箇所）
   - クリックして **自分の iPhone 実機の名前**（例：「○○の iPhone」）を選ぶ
   - 「iPhone 16 Pro」等のシンプルなアイコンはシミュレータなので選ばない
   - 実機が表示されない場合は **Window → Devices and Simulators** で iPhone が認識されているか確認。認識されていなければ USB を抜き差しする
4. 初めて実機ビルドする場合、iPhone 側で **設定 → 一般 → VPN とデバイス管理** から開発元を信頼する操作が必要になる場合がある

---

## Step 3: Family Controls の有効化

> Family Controls は DeviceActivity（Screen Time の計測しくみ）を使うために必要な権限。開発用の権限（dev entitlement）は Apple Developer Program に加入していれば自動で使える。

1. Xcode の左ペインでプロジェクト名（青いアイコンの `SubBuddySpike`）をクリック
2. 中央ペインの左側に **PROJECT** と **TARGETS** が縦に並ぶ。**TARGETS** の下の `SubBuddySpike`（本体アプリ）を選択
3. 上部タブから **Signing & Capabilities** を選択
4. 左上の **+ Capability** ボタンを押す
5. 検索ボックスに `Family Controls` と入力し、表示された **Family Controls** をダブルクリックで追加
6. 追加されると「Family Controls」セクションが表示される
7. 「Development only version」の警告が出るが、Spike では無視してよい（配布時に Distribution 版を申請する）

---

## Step 4: App Groups の設定

> App Groups は、本体アプリと Monitor 拡張（裏で動く小プログラム）がデータを受け渡すための共有の保管棚。

1. Step 3 と同じ **Signing & Capabilities** 画面のまま
2. **+ Capability** → 検索ボックスに `App Groups` と入力 → **App Groups** をダブルクリックで追加
3. 追加された「App Groups」セクションの **+** ボタンを押す
4. App Group ID を入力する：`group.com.yourname.SubBuddySpike`
   - `com.yourname` の部分は Step 1 で設定した Organization Identifier に合わせる
5. 「OK」を押して App Group が有効になったことを確認する（チェックマークが付く）

---

## Step 5: DeviceActivityMonitor Extension（拡張）の追加

> Monitor 拡張は、アプリを開いていなくても iOS が裏で動かす小さなプログラム。「○分使った」という通知を受け取る役割。

1. メニューバー **File → New → Target...** を選択
2. テンプレート選択画面で：
   - 上部タブ：**iOS** を選択
   - 検索ボックスに `Device Activity` と入力
   - **Device Activity Monitor Extension** を選択
   - 「Next」を押す
3. 設定画面で：
   - **Product Name**: `MonitorExtension`
   - **Team**: 本体アプリと同じ開発者アカウント
   - **Bundle Identifier**: 自動で `com.yourname.SubBuddySpike.MonitorExtension` になる
   - 「Finish」を押す
4. 「Activate "MonitorExtension" scheme?」と聞かれたら「Activate」を押す
   - **注意**: これにより Xcode のスキームが `MonitorExtension` に切り替わる。後の Step 8 で `SubBuddySpike` に戻す必要がある

### 拡張にも Family Controls と App Groups を設定する

5. Xcode の左ペインで青いアイコンのプロジェクト名をクリック
6. 中央ペインの **TARGETS** の一覧から **`MonitorExtension`** を選択する
   - TARGETS の下に `SubBuddySpike` と `MonitorExtension` の2つが並んでいる。**下の方**をクリック
7. **Signing & Capabilities** タブを開く
8. **+ Capability** → **Family Controls** を追加
9. **+ Capability** → **App Groups** を追加
10. App Groups の **+** ボタン → Step 4 と **同じ** App Group ID（`group.com.yourname.SubBuddySpike`）を入力
    - 本体と拡張で同じ ID にしないとデータが共有できない

---

## Step 6: Swift ソースファイルの取り込み

### 6-1. Xcode が自動生成したファイルを削除する

Xcode がデフォルトで作成するファイルは使わないので削除する：

1. 左ペインのファイルツリーで、`SubBuddySpike` グループ内の以下を右クリック → **Delete** → **Move to Trash**：
   - `ContentView.swift`（自動生成されたもの）
   - `SubBuddySpikeApp.swift`（自動生成されたもの）
2. `MonitorExtension` グループ内の以下も同様に削除：
   - `DeviceActivityMonitorExtension.swift`（自動生成されたもの）

### 6-2. 本リポジトリの Swift ファイルを取り込む

Finder で `spikes/ios-screen-time/` フォルダを開き、Xcode の**左ペイン（ファイルツリー）**にドラッグ＆ドロップする。

**本体アプリ（`SubBuddySpike` ターゲット）に追加するファイル：**

| ドラッグ元 | ドロップ先 | 含まれるファイル |
|---|---|---|
| `SubBuddySpike/App/` フォルダごと | 左ペインの `SubBuddySpike` グループ | `ContentView.swift`, `MonitorScheduler.swift`, `SpikeViewModel.swift`, `SubBuddySpikeApp.swift`, `UsageSyncService.swift` |

ドロップ時のダイアログで：
- **Copy items if needed**: チェックする
- **Add to targets**: `SubBuddySpike` にチェック（`MonitorExtension` はチェックしない）

**共有ファイル（両ターゲットに追加）：**

| ドラッグ元 | ドロップ先 | 含まれるファイル |
|---|---|---|
| `SubBuddySpike/Shared/` フォルダごと | 左ペインの `SubBuddySpike` グループ | `Constants.swift`, `MappingStore.swift`, `SharedStore.swift`, `UsageBucket.swift` |

ドロップ時のダイアログで：
- **Copy items if needed**: チェックする
- **Add to targets**: `SubBuddySpike` と `MonitorExtension` の **両方** にチェック

**Monitor 拡張（`MonitorExtension` ターゲット）に追加するファイル：**

| ドラッグ元 | ドロップ先 | 含まれるファイル |
|---|---|---|
| `MonitorExtension/` フォルダ内の `DeviceActivityMonitorExtension.swift`（ファイル単体） | 左ペインの `MonitorExtension` グループ | `DeviceActivityMonitorExtension.swift` |

ドロップ時のダイアログで：
- **Copy items if needed**: チェックする
- **Add to targets**: `MonitorExtension` にチェック（`SubBuddySpike` はチェックしない）
- 「Would you like to configure an Objective-C bridging header?」と聞かれたら **Don't Create** を選ぶ

### 6-3. ATS（App Transport Security）の設定（重要）

iPhone からローカル Mac への HTTP 通信を許可する設定。これがないと送信が全て失敗する。

1. 左ペインで **SubBuddySpike** ターゲットの **Info** タブを開く（Signing & Capabilities の隣）
2. **Custom iOS Target Properties** セクションの **+** ボタンを押す
3. Key に `App Transport Security Settings` と入力（`NSAppTransportSecurity` と表示される）
4. 追加された行を展開し、その中の **+** を押す
5. Key に `Allow Arbitrary Loads` と入力 → Value を **YES** に設定
6. **MonitorExtension** ターゲットにも同じ設定を追加する（拡張は今回通信しないが念のため）

> この設定は**開発用の一時的な許可**。本格実装では正規の証明書または特定ドメインの例外に切り替える。

### 6-4. Target Membership の確認（重要）

Shared フォルダの4ファイルが**両方のターゲット**に所属していることを確認する。ここが漏れるとビルドエラーになる。

1. 左ペインで `Constants.swift` をクリックして選択
2. 右ペインを表示する（見えなければ **`Cmd + Option + 1`** を押すか、Xcode 右上の右端のアイコンをクリック）
3. 右ペインの **Target Membership** セクションで、**SubBuddySpike** と **MonitorExtension** の**両方にチェック**が入っていることを確認。入っていなければチェックを入れる
4. `SharedStore.swift`、`UsageBucket.swift`、`MappingStore.swift` の残り3ファイルでも同じ確認をする

---

## Step 7: 定数の設定

> `Constants.swift` は実 IP・トークンを書き込むため **Git 追跡対象外**（`.gitignore` 済み）。
> 初回は `Constants.swift.example` を `Constants.swift` にコピーして使う：
> ```bash
> cp spikes/ios-screen-time/SubBuddySpike/Shared/Constants.swift.example \
>    spikes/ios-screen-time/SubBuddySpike/Shared/Constants.swift
> ```

`Shared/Constants.swift` を開き、自分の環境に合わせて3箇所を変更する。

```swift
enum SpikeConstants {
    // ① 自分の App Group ID に変更（Step 4 で設定したもの）
    static let appGroupID = "group.com.yourname.SubBuddySpike"

    // ② Mac の SubBuddy が動いている IP アドレスとポートに変更
    static let apiBaseURL = "http://192.168.1.100:3000"

    // ③ Mac 側の apps/web/.env にある USAGE_SYNC_TOKEN の値をコピー
    static let syncToken = "YOUR_USAGE_SYNC_TOKEN"
    ...
}
```

### ① App Group ID

Step 4 で設定した ID をそのままコピーする。

### ② Mac の IP アドレスと、SubBuddy の LAN 公開

> ⚠️ ここが最大の難所。`127.0.0.1`（localhost）は**使えない**。iPhone にとって `127.0.0.1` は
> iPhone 自身を指すため Mac には届かない。プロトコルも `http`（`https` の自己署名は ATS で失敗する）。

**(a) Mac の LAN IP を調べる**
```bash
ipconfig getifaddr en0
```
表示された IP（例：`192.168.1.100`）を `apiBaseURL` に `http://<IP>:3000` の形で設定する。

**(b) SubBuddy を LAN から届くように公開する** — 起動方法で手順が分かれる：

- **Mac 上で直接起動する場合**：全インターフェースで待ち受ける。
  ```bash
  cd apps/web
  npx next dev --hostname 0.0.0.0
  ```

- **devcontainer（Dev Containers）内で起動している場合**：VS Code の転送は既定で
  `127.0.0.1` にしかバインドされず iPhone から届かない。**VS Code のユーザー設定**
  （`Cmd+Shift+P` → `Open User Settings (JSON)`）に次を追加し、ウィンドウを再読み込みする：
  ```json
  "remote.localPortHost": "allInterfaces"
  ```
  これで転送ポートが Mac の `0.0.0.0:3000` にバインドされる。コンテナ内でサーバーは
  `--hostname 0.0.0.0` で起動しておく。

**(c) iPhone を触る前に Safari で必ず検証する（重要）**

iOS アプリを介さず、**iPhone の Safari** で `http://<IP>:3000` を開く。
SubBuddy が表示されれば「ネットワーク経路は正常」と確定でき、以降のエラーをアプリ側に切り分けられる。
表示されないうちは iPhone アプリで送信しても無駄。まずここを通す。

確認用（バインド先を Mac で直接見る）：
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```
`*:3000` または `0.0.0.0:3000` なら全インターフェース公開済み。`127.0.0.1:3000` なら未公開。

### ③ USAGE_SYNC_TOKEN の確認

SubBuddy の `apps/web/.env` ファイルを開き、`USAGE_SYNC_TOKEN=` の行の値をコピーして `syncToken` に設定する。
これが Mac 側と一致しないと送信が 401 になる。

---

## Step 8: ビルドと実行

### 8-1. スキームとデバイスの確認

Xcode 上部ツールバーの **▶（Run ボタン）の右隣**に「スキーム名 > デバイス名」が表示されている。

1. **スキーム**が `MonitorExtension` になっている場合は、クリックして **`SubBuddySpike`** に切り替える
   - `SubBuddySpike` が選択肢にない場合：クリック → 一番下の **Manage Schemes...** → 左下の **+** → Target に **SubBuddySpike** を選択 → OK
2. **デバイス**が自分の iPhone 実機になっていることを確認（シミュレータではない）

### 8-2. ビルド・転送・起動

1. **▶ Run**（または `Cmd + R`）を押す
2. キーチェーンのパスワードを聞かれたら **Mac のログインパスワード**（Mac 起動時に入力するもの）を入力 →「許可」または「常に許可」
3. ビルドが成功すると iPhone にアプリが転送・起動される

### よくあるエラーと対処

| エラー | 原因 | 対処 |
|---|---|---|
| `Signing for "SubBuddySpike" requires a development team` | Team が未選択 | Signing & Capabilities で自分のアカウントを選ぶ |
| `Unable to process request - PLA Update available` | Apple の利用規約に未同意 or サーバー反映待ち | https://developer.apple.com/account で規約に同意。反映に数時間かかることがある。Xcode の Settings → Accounts でアカウントを削除→再追加 |
| `No profiles for 'com.xxx' were found` | 上記の PLA 未反映が原因であることが多い | 同上 |
| `No such module 'FamilyControls'` | iOS 16 未満のデプロイターゲット | プロジェクト設定 → General → Minimum Deployments を iOS 16.0 以上にする |
| `Type 'SpikeViewModel' does not conform to protocol 'ObservableObject'` | `import Combine` が不足 | `SpikeViewModel.swift` の冒頭に `import Combine` を追加 |
| `Cannot find 'SharedStore' in scope` | Shared ファイルが MonitorExtension ターゲットに未追加 | Step 6-3 の Target Membership 確認を行う |
| `A valid provisioning profile for this executable was not found` | 実機の信頼設定が未完了 | iPhone の 設定 → 一般 → VPN とデバイス管理 → 開発元を信頼 |
| `App Group ID is invalid` | App Group ID の書式が不正 | `group.` で始まる必要がある。例: `group.com.yourname.SubBuddySpike` |

### 実機で「閾値に到達するのにレコードが書かれない」場合（重要）

Console.app（iPhone を選択）に `UsageTrackingAgent ... Failed to notify (null) that ..._15m's threshold was reached: ... ExtensionError Code=0` が出る場合、**Monitor 拡張が起動できていない**。原因と対処：

| 症状 | 原因 | 対処 |
|---|---|---|
| `Failed to notify ... ExtensionError Code=0` | 拡張のクラス名が Info.plist の `NSExtensionPrincipalClass` と不一致 | `DeviceActivityMonitorExtension.swift` のクラス名を、拡張ターゲットの Info.plist が指す `$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension` に合わせる（既定の自動生成クラス名と同じにする） |
| 拡張のログが Console に一切出ない | 拡張内で `print` を使っている | `os.Logger`（`import os`）に置き換える。`print` は拡張プロセスからは Console に出ない |
| 閾値到達しても本体のレコードが 0 | 監視開始**前**の利用がカウントされていない | `DeviceActivityEvent(..., includesPastActivity: true)` にする |
| 起動直後にクラッシュ | App Group / `UserDefaults(suiteName:)` の force unwrap (`!`) | Optional 化し、nil ならログを出して return（フェイルセーフ） |

---

## Step 9: 動作確認（最小縦割り）

iPhone でアプリが起動したら、画面の上から順に操作する：

### 9-1. 認可と対象選択

1. **「Screen Time の許可を求める」** をタップ → iOS の許可ダイアログで許可する
2. **「アプリを選ぶ」** をタップ → 計測したいアプリを1つ選んで「完了」

### 9-2. サブスク ID の入力

3. **サブスク ID** に Mac 側の SubBuddy で登録済みのサブスク ID を入力する
   - 調べ方：Mac のブラウザで SubBuddy のサブスク詳細画面を開き、URL の `subscriptions/xxx` の `xxx` 部分をコピーする
   - ⚠️ **必ず「いま送信先になっている DB」に実在する ID** を使う。存在しない ID を送ると
     外部キー制約で **HTTP 500** になる（DB を再シードすると ID が変わる点に注意）。今ダッシュボードに
     表示されているサブスクの ID を使えば確実。

### 9-3. 監視の開始

4. **「監視を開始」** をタップ → ステータスバーに「監視中: sub_xxx」と表示されれば成功

### 9-4. 利用量の記録（15分以上使う）

5. iPhone のホーム画面に戻り、Step 9-1 で選んだアプリを **15〜20分以上** 使う
   - DeviceActivity には約15分の計測下限がある。15分ぴったりでは反応しないことがあるので、余裕を持って20分程度使う

### 9-5. 記録の確認

6. SubBuddySpike に戻り **「読み取り更新」** をタップ
7. レコード一覧に「日付 — 15m_plus」のような行が表示されれば **MUST-1（受け渡しの堅牢性）の最初の確認が成功**

### 9-6. Mac への送信

8. **「読み取り更新」でレコード数が 1 以上**であることを確認してから **「未送信データを送信」** をタップ
   （レコード 0 件で送信しても `{"items":[]}` が送られ、エラーなく何も起きない）
9. 送信に成功すると、送ったレコードはローカルから削除され**レコード数が 0 に戻る**。
   これは失敗ではなく成功の印（2xx が返った証拠）。
10. Mac 側で DB に着弾したか確認する。

> **着弾確認は `created_at`（作成時刻）で絞らないこと**。冪等 upsert は既存行を update するため
> `created_at` は変わらない。`usage_date` と、iOS 由来なら値が入る `estimated_minutes_min`
> （seed データは空）で判別する。確認 SQL の例：
> ```sql
> SELECT s.name, u.usage_date, u.usage_bucket, u.estimated_minutes_min, u.source
> FROM ios_usage_daily_summaries u JOIN subscriptions s ON s.id = u.subscription_id
> WHERE u.subscription_id = '<送ったサブスクID>' AND u.usage_date = '<送った日付>';
> ```

> **送信エラーの切り分け**：
> - `Could not connect` / `timed out` → ネットワーク（Step 7② を再確認。まず iPhone Safari で疎通確認）
> - HTTP 401 → `USAGE_SYNC_TOKEN` 不一致
> - HTTP 500 → サブスク ID が送信先 DB に実在しない（9-2 参照）
> - エラーなしでレコードが消えない＋DB にも無い → レコード 0 件で空送信していた

---

## Step 10: 検証の進め方（Spike の本題）

Step 9 で最小縦割りが通ったら、tasklist.md の段階1〜7 に沿って検証を進める。

| 段階 | 内容 | 確認する MUST |
|---|---|---|
| 段階1 | 複数同時到達・再起動後のデータ保持 | MUST-1 |
| 段階2 | 最小縦割り（Step 9 で完了） | AC-2 |
| 段階3 | iPhone 再起動後の復旧・許可失効時の再対応づけ | MUST-2, MUST-8 |
| 段階4 | 三点照合（7日間の精度検証）・日付境界・ゼロ日の判別 | MUST-3, MUST-4, MUST-5 |
| 段階5 | 監視対象を増やして限界試験（5→10→20 サブスク） | MUST-6 |
| 段階6 | ネットワーク不通→再送・Mac 停止→復旧の同期堅牢性 | MUST-7 |
| 段階7 | entitlement 申請用の用途説明・PrivacyInfo 草案 | MUST-9 |

各段階の結果は `.steering/20260606-ios-screen-time-spike/tasklist.md` に記録する。
全 MUST が OK なら **go（本格実装に進む）**。1つでも NG なら **no-go（P1 判定を見送り、P2〜P6 のみで運用）**。
