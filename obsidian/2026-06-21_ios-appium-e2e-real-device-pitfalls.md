---
title: "実機 iPhone で Appium E2E 自動化を組むときの落とし穴集"
type: pitfall
created: 2026-06-21
updated: 2026-07-17
expires_review: 2026-12-21
confidence: high
tags:
  - testing
  - pitfall
  - ios
  - appium
  - swift
  - devops
aliases:
  - iOS Appium 実機 E2E 落とし穴
  - XCUITest 実機 自動化 つまずき
  - real device appium pitfalls
  - DeviceActivity E2E 自動化
---

# 実機 iPhone で Appium E2E 自動化を組むときの落とし穴集

> 現行性注記（2026-07-17）：LAN IP、`USAGE_SYNC_TOKEN`、旧開発画面の記述はlocal mode / Spikeの履歴である。cloud-testflight modeの主経路はRender HTTPS、Appleサインイン、短期アクセストークン、ローテーション更新トークン、デバイス同期トークン、利用者向け「ホーム・契約・見直し」UIを使う。認証経路の実機確認は完了し、現行UIの実機API結合は`.steering/20260716-ios-main-ui/`で管理する。

## TL;DR

- GUI を使わず「ビルド → 実機インストール → Appium でアプリ操作 → Web で結果確認」を**コマンド一発で回す実機 E2E**を組む過程で踏んだ罠を、症状→原因→対処で並べた逆引き集（pitfall カタログ）。
- 多くは「設定を戻すと再発する」恒久対処済みの罠（codesign / Node バージョン / ポート競合 / WDA 署名 / 認可保持など）。**設定の意味が分からないまま消すと再発する**ので、各項に「なぜそうするか」を残している。
- とくに見落としやすいのが **Mac の LAN IP が再起動・DHCP で変わって iPhone からの同期が無言で失敗する**問題。IP が 2 箇所（アプリ・ショートカット）に焼き込まれている構造が原因で、切り分けには独特の罠がある（後述）。

## 何が罠か / Why It's Tricky

実機での E2E 自動化は、シミュレータや単体テストでは出ない「実機・実署名・実ネットワーク」由来の壁が層をなして現れる。1 つ突破すると次が出る、という形で詰まりやすく、しかもエラーメッセージが原因を直接指していないことが多い（例：LAN IP ズレは「接続できない」ではなく「タイムアウト」や「ログに何も出ない」として現れる）。

この文書は SubBuddy の iOS Screen Time Spike（`spikes/ios-screen-time/`）で、DeviceActivity による利用量計測アプリを実機 E2E にかけたときの一次記録。**計測精度の検証ではなく、「iPhone アプリ → Mac → Web」の配線が実機で通るかを見る結合スモークテスト**を前提にしている。

## 前提・適用範囲 / Applicability

- 対象：実機 iPhone を USB 接続した MacBook 上で、XcodeGen + xcodebuild + Appium(XCUITest) + Playwright を組み合わせた E2E。
- 環境前提（このプロジェクト固有・混乱しやすい点）
  - **開発支援環境はDev Container（Linux）で動く。そこではiOSビルド・実機・Appiumは動かない**（xcodebuild / xcrun / USBがない）。実機E2EはMacのネイティブ環境で実行する。
  - Web アプリ（Next.js）と PostgreSQL は**コンテナ側で `0.0.0.0` 起動**し、VS Code のポート転送で Mac の `127.0.0.1:3000` と LAN から到達できる。Mac 側で二重起動するとポート競合するので避ける。
- 適用範囲外：計測の「精度」検証（それは別途の手動フィールドテストの役割）。
- バージョン依存が強い項目（Node・iOS・API 可用性）が含まれる。**※ 後述の各項は 2026-06-21 時点**。バージョンが変われば閾値も変わりうる。

## 実装・適用例 / Example

各罠を「症状 → 原因 → 対処」で示す。対処の根拠ファイルは本プロジェクトのパスで併記する。

### 1. codesign が `resource fork ... detritus not allowed` で落ちる

- 症状：`xcodebuild` のビルドで `resource fork, Finder information, or similar detritus not allowed` が出て署名に失敗する。
- 原因：ワークスペースが Mac の Desktop 配下（iCloud 同期対象）に置かれており、iCloud / Finder が付与する**拡張属性（extended attributes）**がビルド成果物に残る。codesign は拡張属性付きファイルを拒否する。
- 対処：
  1. DerivedData を同期フォルダの外（`${TMPDIR}`）に逃がす。
  2. ソースと生成プロジェクトに `xattr -cr`（拡張属性の再帰削除）をかけてからビルドする。
  - 根拠：`spikes/ios-screen-time/scripts/run-e2e-real-device.sh`（`xattr -cr` と `DERIVED="${SUBBUDDY_DERIVED_DATA:-${TMPDIR:-/tmp}/...}"`）。

### 2. ビルドが `includesPastActivity is only available in iOS 17.4` で落ちる

- 症状：DeviceActivity の `DeviceActivityEvent(... includesPastActivity:)` を使うと、`includesPastActivity is only available in iOS 17.4` というコンパイルエラーで落ちる。
- 原因：`includesPastActivity` は iOS 17.4+ の API。デプロイ先（deploymentTarget）が低いと使えない。
- 対処：`project.yml`（XcodeGen 定義）の deploymentTarget を **iOS 17.4** にする。
  - 観測事実（このプロジェクトの一次証跡）：`spikes/ios-screen-time/SubBuddySpike/App/MonitorScheduler.swift` が `includesPastActivity: true` を使用しており、deploymentTarget を 17.4 未満にすると上記のコンパイルエラーが再現する。**「iOS 17.4 が必要」という事実はこのコンパイラ診断そのものが直接の証拠**（コンパイラが可用性バージョンを名指しする）。
  - 一次情報（参照ポインタ）：Apple 公式の API リファレンス（[Apple Developer: DeviceActivityEvent includesPastActivity](https://developer.apple.com/documentation/deviceactivity/deviceactivityevent/includespastactivity)）。※ ページは JS レンダリングのため本文取得不可で可用性バッジを本文では確認できていない。可用性の確証はコンパイラ診断側に置く。参照日 2026-06-21

### 3. Appium の `/session` 作成で `UND_ERR_INVALID_ARG` になる

- 症状：Appium セッション確立時に `UND_ERR_INVALID_ARG` で失敗する。
- 原因（このセッションでの観測）：Node 24 系に同梱の undici（HTTP クライアント）が webdriverio v9 と非互換だった。Node 24 で再現し、22 LTS で解消したという観測事実に基づく切り分け。
- 対処：**Node 22 LTS** を使う（`brew install node@22`）。
- 補足（経験則ラベル）：「最新の Node だから速い／安全」という直感で 24 系を入れると踏む。**E2E ツールチェーンは Node の偶数 LTS に固定する**のが安全側、という運用ヒューリスティック。反証条件：webdriverio / undici 側が新 Node に追従したバージョンなら解消しうるため、ツール更新時は再確認する。

### 4. Appium 起動後にハングする／ポートが競合する

- 症状：Appium を起動しても応答せず固まる、あるいは起動できない。
- 原因：**VS Code がポート 4723 を占有している**（ポート転送等）。さらに、`curl` で起動待ちをするときにタイムアウトを付けないと「接続は受け付けるが無応答」状態で**永久ハング**する。
- 対処：
  1. 使用中なら空きポートを探索して Appium に渡す。
  2. 起動待ちの `curl` に必ず `--connect-timeout` / `--max-time` を付ける。
  - 根拠：`spikes/ios-screen-time/scripts/run-e2e-real-device.sh`（`port_busy` 関数で空きポート探索、`curl -sf --connect-timeout 2 --max-time 3 .../status`）。
  - 設計原則：外部プロセスの起動待ちポーリングは**必ずタイムアウト付き**で書く（ガードレール無しのブロッキング待機は CI/自動化を巻き込んで固まる）。

### 5. WDA が `No profiles ...xctrunner`（xcodebuild code 65）で落ちる

- 症状：WebDriverAgent（WDA）のビルド・署名で `xcodebuild failed code 65 / No profiles for '...xctrunner' were found`。
- 原因：WDA 用ランナーの署名でプロビジョニングプロファイルが自動生成されない。
- 対処：Appium の capabilities に次を指定する。
  - `updatedWDABundleId`（WDA のバンドル ID を自分の Team で署名できる ID に差し替える）
  - `allowProvisioningDeviceRegistration: true`（デバイス登録を伴うプロファイル自動生成を許可）
  - 根拠：`spikes/ios-screen-time/e2e/config.mjs`（capabilities 定義）。

### 6. `accessibilityIdentifier` で見つけたい要素が「存在しない」と言われる

- 症状：画面下方の要素（例：ステータス表示）が `still not existing` で見つからない。
- 原因：**SwiftUI の `List` は画面外の要素を遅延描画する**ため、スクロールするまで要素ツリーに現れない。
- 対処：
  1. スモークの起点は最上部に置いた安定要素（例：認可ステータス）にする。
  2. 下方の要素は「スクロールしながら探す」探索（findScrolling 相当）で取りに行く。
  3. ついでに、SwiftUI で WDA がキーボードを閉じられず `hideKeyboard` が無駄リトライ（約 13 秒）するのを観測したら、その呼び出しは削除する（スクロール探索で代替できる）。
  - 根拠：`spikes/ios-screen-time/SubBuddySpike/App/ContentView.swift`（`auth-status` 等の `accessibilityIdentifier` 付与）。

### 7. 起動するたびに「未認可」表示に戻る

- 症状：Screen Time（FamilyControls）の許可を一度与えても、アプリを起動し直すと UI が毎回「未認可」に戻る。
- 原因：アプリ起動時に OS レベルの認可状態を**読み直していなかった**。FamilyControls の認可は再起動・再インストール後も OS 側に保持されるが、UI 状態は初期値のままになる。
- 対処：ViewModel の `init()` で `AuthorizationCenter.shared.authorizationStatus == .approved` を反映する。
  - 根拠：`spikes/ios-screen-time/SubBuddySpike/App/SpikeViewModel.swift`（`init()` 内で認可状態を反映）。

### 8. UDID を取り違えてビルド先・接続先がズレる

- 症状：`xcodebuild` / Appium が実機を見つけられない、または別デバイスを指す。
- 原因：iOS には別種の識別子があり、混同しやすい。
  - **ハードウェア UDID**：`8桁-16桁` 形式。`xcrun xctrace list devices` が表示する。**xcodebuild / Appium が使うのはこちら**。
  - **CoreDevice UUID**：`8-4-4-4-12` 形式。`xcrun devicectl list devices` の Identifier はこれで、用途が別物。
- 対処：UDID の自動検出は **xctrace を優先**する。
  - 根拠：`spikes/ios-screen-time/scripts/setup.sh` / `preflight.sh`（xctrace 優先で UDID 検出）。

### 9.【特に重要】Mac の LAN IP が再起動・DHCP で変わり、iPhone からの同期が無言で失敗する

実機 E2E では「アプリが起動・操作できる」ことと「ネットワークが到達する」ことが別問題で、後者は静かに壊れる。

- 症状：
  - iPhone からの同期（ショートカット経由の送信）が `request time out`。
  - Web 側のログに POST が**一切出ない**（＝リクエストがサーバに届いていない）。
- 原因：Mac の LAN IP が**再起動・DHCP で変わる**。その IP がアプリの `apiBaseURL` と iPhone ショートカットの送信先 URL の**2 箇所に焼き込まれている**ため、再起動で実 IP とズレて宛先不達になる。
- 対処（IP 変化を毎回吸収する）：
  1. `refresh-ip.sh` を実行し、現在の LAN IP を検出して `Constants.swift` の `apiBaseURL` を更新する。
     - IP 検出は **デフォルトルートのインターフェースから取る**（`route -n get default` → `ipconfig getifaddr`）。`en0` 決め打ちは **Ethernet / Thunderbolt を併用していると Wi-Fi が en1 等になり誤検出**するため不可。
  2. IP が変わったら **アプリを再ビルド・再インストール**する。`apiBaseURL` は**アプリにコンパイルされる**ため、`SKIP_BUILD=1`（インストール省略）では旧 IP のまま送信してしまう。
  3. **ショートカットの送信先 URL も**書き換える（もう 1 箇所の焼き込み）。
  - 根拠：`spikes/ios-screen-time/scripts/refresh-ip.sh`（デフォルトルート優先の `detect_lan_ip`、`apiBaseURL` 置換、再ビルド／ショートカット変更の案内）。`run-e2e-real-device.sh` は実行前に `refresh-ip.sh` を呼び、IP 変更時に `SKIP_BUILD=1` だと警告する。

#### 9-1. 切り分けの罠（ここで時間を溶かしやすい）

- **「モバイル通信では `192.168.x.x` に繋がるのに、Wi-Fi では繋がらない」は異常のサイン**。私的 IP（プライベートアドレス）は本来モバイル回線からは到達できないので、これは **VPN または iCloud プライベートリレーが経路を変えている兆候**。意図せず有効になっているとデバッグ結果を誤読する。
- **AP アイソレーション（クライアント分離）**も同類の遮断要因。同じ Wi-Fi 配下でも端末同士の通信をルーターが遮断していると、IP が正しくても届かない。
- 切り分けの最短手順：まず **iPhone(Wi-Fi) の Safari で `http://<MacのIP>:3000` を開く**。開ければ経路 OK（問題はアプリ／ショートカット側）。開けなければネットワーク経路側（IP ズレ・VPN・プライベートリレー・AP アイソレーション）を疑う。

## 注意点 / Caveats

- 上記の対処はすべて**恒久対処としてスクリプト／コードに織り込み済み**。意味を理解せず設定を戻すと再発する。
- 以下は本文（落とし穴集）の対象外だが、**E2E が「通った後」に何を検証しているのかを誤解しないための参照ポインタ**として最小限だけ残す。各項の正は実装コード側にあり、ここでは要点のみ。
- ネットワーク到達と認証・冪等性は別レイヤーの関心事。配線が通った後、サーバ側の契約は以下：
  - 同期は`POST /api/usage/daily`を使う。local modeは`USAGE_SYNC_TOKEN`、cloud-testflight / productionは登録端末のデバイス同期トークンで認証する。根拠：`apps/web/src/lib/usage-auth.ts`。
  - 保存は`subscription_id × usage_date`を一意キーにした冪等upsertで、再送時は利用バケットと概算時間の最大値へ収束する。認証済みユーザーの所有権確認と保存は同一transactionで行う。根拠：`apps/web/src/repositories/usage.ts`。
- 計測の意味（E2E が運ぶデータの性質。誤解しやすい）：
  - DeviceActivity は**前面利用時間**を閾値（15 / 30 / 60 / 120 分）で測り、バケット（`m15_plus`..`m120_plus`、上限 120 分）化する。根拠：`MonitorScheduler.swift`（`SpikeConstants.thresholdMinutes`）／ `apps/web/src/lib/usage-bucket.ts`。
  - **ロック中の背景音声・別端末での視聴・他アプリへ切り替え中は計測外**。利用量は「前面で見ていた時間」の下限近似でしかない。
  - Shortcuts 起動シグナルは「前面で開いた事実」だけを表す（`used=true / bucket=none / source=ios_shortcut`）。時間量ではない。
- セキュリティ運用上の注意：`SubBuddySpike/Shared/Constants.swift` には実トークン・実 IP・実サブスク ID が書かれうる（gitignore 対象であるべきファイル）。**実値をコミットしない**。本文の値はすべて例示・プレースホルダ。

## 関連ナレッジ / Related

- [[dev-env-quirks]] — このプロジェクトのローカル開発環境の癖（PostgreSQL 手動起動・ポート転送など）
- [[2026-06-07_terminal-japanese-copy-mojibake-osc52]] — Dev Container × Mac ホストで起きる別系統の落とし穴

## 参考文献 / References

- [Apple Developer: DeviceActivityEvent.includesPastActivity](https://developer.apple.com/documentation/deviceactivity/deviceactivityevent/includespastactivity) — iOS 17.4+ で利用可能な API であること。参照日 2026-06-21
- [Apple Developer: AuthorizationCenter (FamilyControls)](https://developer.apple.com/documentation/familycontrols/authorizationcenter) — `authorizationStatus` による認可状態の参照。参照日 2026-06-21
- [Appium XCUITest Driver: Real device setup / capabilities](https://appium.github.io/appium-xcuitest-driver/latest/) — `updatedWDABundleId` / `allowProvisioningDeviceRegistration` 等、WDA 署名まわり capability の一次情報。参照日 2026-06-21
- [Node.js Releases (LTS schedule)](https://nodejs.org/en/about/previous-releases) — 偶数系を LTS に固定する根拠（バージョン選定）。参照日 2026-06-21

> ※ バージョン依存（Node・iOS・各ドライバ）・ツールの非互換状況は変化しうる。本文の状況は参照日（2026-06-21）時点。再レビュー目安：2026-12-21。
