# 引き継ぎ資料：iOS Screen Time Spike の実機 E2E 自動化

> 作成日：2026-06-21 / 対象：`spikes/ios-screen-time/`
> ステータス：**実機 E2E は完走（PASSED）済み**。配線（パイプライン）の通し検証が自動で回る状態。
> 実値（UDID・LAN IP・トークン・Team ID）は本書に書かない。すべて `e2e/.env.local` と `SubBuddySpike/Shared/Constants.swift`（どちらも gitignore）にある。

---

## 1. これは何か（ゴール）

Xcode GUI 操作を使わず、**MacBook 上のコマンド一発**で次を自動実行する実機 E2E：

`xcodebuild でビルド → 実機 iPhone へインストール → Appium(XCUITest) でアプリ操作 → Playwright で Web 管理画面を確認`

「iPhoneアプリ → Mac → Web」の**配線が実機で end-to-end に動くか**を確かめる結合スモークテスト。
**利用量計測の“精度”は対象外**（それは別途「7日間の三点照合」という手動フィールドテストの役割）。

---

## 2. 重要な環境前提（混乱しやすい点）

- **Claude Code が動いているのは Dev Container（Linux）。ここでは iOS ビルド・実機・Appium は一切動かない**（xcodebuild/xcrun/USB なし）。実機 E2E は必ず **Mac のネイティブターミナル**で実行する。
- ワークスペースは Mac の `~/Desktop/files/ClaudeCode/SubBuddy` が **bind mount** されている＝コンテナの `/workspaces/SubBuddy` と同一ファイル。よってコンテナ側で編集した内容は Mac にも反映される。
- **Desktop は iCloud 同期される**ため拡張属性が付き、codesign を壊す要因になる（後述の対処済み）。
- Web アプリ（`apps/web`）は**コンテナ側で起動中**（`next dev --hostname 0.0.0.0`、PostgreSQL も手動起動済み）。VS Code のポート転送経由で Mac の `127.0.0.1:3000` と LAN から到達できる。Mac 側で二重起動しないこと（ポート競合）。

---

## 3. 構成ファイル（このセッションで作成／変更）

| パス | 役割 |
|---|---|
| `spikes/ios-screen-time/project.yml` | XcodeGen 定義。GUI なしで `.xcodeproj`・署名・拡張・ATS を生成。**deploymentTarget iOS 17.4**（`includesPastActivity` が 17.4+ API のため）|
| `spikes/ios-screen-time/scripts/setup.sh` | 初回セットアップ自動化。`.env.local` と `Constants.swift` を生成し、UDID/LAN IP/Team ID/サブスクID/トークンを**全自動取得**。`--run` で実行まで |
| `spikes/ios-screen-time/scripts/preflight.sh` | ビルド前チェック（ツール・実機・Web到達・サブスク実在・App Group）。非macOSで即停止 |
| `spikes/ios-screen-time/scripts/run-e2e-real-device.sh` | 本体。生成→ビルド→インストール→Appium→E2E。`SKIP_BUILD=1` でビルド省略可 |
| `spikes/ios-screen-time/e2e/real-device.test.mjs` | Appium(ネイティブ) + Playwright(Web) のオーケストレータ。失敗時にスクショ・trace 保存 |
| `spikes/ios-screen-time/e2e/config.mjs` | env 読取＋Appium capabilities |
| `spikes/ios-screen-time/e2e/.env.example` / `.env.local` | 環境変数。`.env.local` は gitignore |
| `SubBuddySpike/App/ContentView.swift` | Appium 用に `accessibilityIdentifier` を付与（`auth-status`/`subscription-id-field`/`refresh-records-button`/`record-count`/`sync-button`/`status-message` など）|
| `SubBuddySpike/App/SpikeViewModel.swift` | **起動時に認可状態を読む `init()` を追加**（これが無いと毎回「未認可」表示に戻る）|
| `spikes/ios-screen-time/README.md` | 「## 自動 E2E（実機）」節を追記 |
| `spikes/ios-screen-time/QUICKSTART.md` | 実行だけの短縮版 |

---

## 4. 実行手順（Mac のネイティブターミナル）

### 一度きりの手動（自動化不可）
- iPhone：Developer Mode 有効化／USB 信頼／アプリ内で **Screen Time 許可＋対象アプリ選択**（認可は保持される）
- Mac：`brew install xcodegen` / `npm i -g appium` / `appium driver install xcuitest` / `brew install node@22`（**Node は 22 LTS**。24系は undici で webdriverio が `UND_ERR_INVALID_ARG` になる）

### 通常実行（コード変更を反映）
```bash
cd <repo>/spikes/ios-screen-time
scripts/run-e2e-real-device.sh
```
### 高速反復（再ビルドせず・認可を保持）
```bash
SKIP_BUILD=1 scripts/run-e2e-real-device.sh
```

成功すると `[e2e] PASSED` / `✅ E2E 成功`。失敗時は `e2e/artifacts/<日時>/` に `appium.log`・`xcodebuild.log`・`appium-failure.png`・`playwright-trace.zip`。

---

## 5. 突破した実機特有の壁（＝各設定の理由）

次の順で詰まり、すべて恒久対処済み。**設定を戻すと再発する**ので注意。

| 症状 | 原因 | 対処（場所）|
|---|---|---|
| codesign `resource fork ... detritus not allowed` | iCloud 同期フォルダの拡張属性 | DerivedData を `${TMPDIR}` に＋`xattr -cr`（run-e2e）|
| `includesPastActivity is only available in iOS 17.4` | デプロイ先が低い | `project.yml` を **iOS 17.4** |
| `UND_ERR_INVALID_ARG`（Appium /session）| Node 24 + undici が webdriverio v9 と非互換 | **Node 22 LTS** |
| appium 起動後ハング／`code 65` 前のポート | **VS Code が 4723 を占有** | run-e2e がポート使用中なら自動で空きへ＋curl にタイムアウト |
| WDA `xcodebuild failed code 65 / No profiles ...xctrunner` | WDA 署名でプロファイル自動生成不可 | capabilities に `updatedWDABundleId` ＋ **`allowProvisioningDeviceRegistration: true`**（config.mjs）|
| `~status-message still not existing` | SwiftUI List は画面外を遅延描画 | スモークは最上部 `auth-status`、下方は `findScrolling` でスクロール探索 |
| 毎回「未認可」に戻る | アプリが起動時に認可状態を読んでいなかった | `SpikeViewModel.init()` で `AuthorizationCenter.shared.authorizationStatus` を反映 |
| `hideKeyboard` の無駄なリトライ（13秒）| SwiftUI で WDA がキーボードを閉じられない | 当該呼び出しを削除（findScrolling で代替済み）|

UDID は **ハードウェア UDID（8桁-16桁、`xctrace` 表示）** を使う。`devicectl` の Identifier は CoreDevice UUID（8-4-4-4-12）で別物。検出は xctrace 優先（setup.sh / preflight.sh）。

---

## 6. 未対応・要判断（次セッションへの申し送り）

1. **【セキュリティ・要対応】`SubBuddySpike/Shared/Constants.swift` が git 追跡されている。** `setup.sh` は実トークンをこのファイルに書くため、誤コミットで認証情報が漏れる恐れ。現コミット版はプレースホルダなので未漏洩だが、`git rm --cached spikes/ios-screen-time/SubBuddySpike/Shared/Constants.swift` で追跡解除を推奨（ユーザー未実施）。
2. **【別テーマ・未着手】「使用量コメント」機能**：本セッション前半で Claude/Gemini/Codex の三者議論を実施。結論の方向性＝「種別で出し分けるハイブリッド時間ベース／`usageComment` を第三系統で分離／『約〜時間以上』近似表記」。ただし**ユーザー判断は保留**（「議論の結果を見てから考える」）。実装は未着手。`apps/web/src/domain/scoring/`（reasons.ts / computeRecommendation.ts）が対象。
3. **【精度検証・手動】7日間の三点照合**（field-test-guide.md）は別途必要。E2E は配線確認のみで精度は見ない。
4. ナレッジ化（knowledge-scribe で「実機 Appium E2E 構築の落とし穴集」を Obsidian に残す）は未実施。価値は高い。

---

## 7. よく使う診断コマンド（Mac）

```bash
# 実機が見えるか（ハードウェアUDID表示）
xcrun xctrace list devices
xcrun devicectl list devices
# ビルドエラーの原因行だけ
scripts/run-e2e-real-device.sh 2>&1 | grep -E "error:|BUILD FAILED|FAILED"
# WDA署名エラーの詳細
grep -nE "error:|No profiles|provisioning|Signing" e2e/artifacts/$(ls -t e2e/artifacts | head -1)/appium.log | tail -60
# Web側のサブスクID取得（再シードでID変わる→.env.local更新）
curl -s http://127.0.0.1:3000/api/subscriptions | grep -oE '"id":"[^"]+"' | head -1
```
