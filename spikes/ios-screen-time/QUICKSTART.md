# QUICKSTART — 実機 E2E（自動）

> 毎回ここだけ見れば動く短縮版。背景・トラブル対処は [README.md](./README.md) の「自動 E2E（実機）」へ。
> **Mac のターミナル（Dev Container の外）で実行する。** コンテナ内では動かない（`xcodebuild`・実機 USB が無いため）。

---

## 1. 初回だけ

### 1-1. 人手でしかできない物理手順（自動化不可）

**iPhone**
- Developer Mode を有効化（設定 → プライバシーとセキュリティ → デベロッパモード → 再起動）
- USB 接続時に「信頼」
- アプリ上で Screen Time 許可・対象アプリ選択を 1 回実施

**Mac（ツール導入）**
```bash
brew install xcodegen
npm install -g appium
appium driver install xcuitest
```

### 1-2. 設定ファイルは自動生成（setup.sh）

`e2e/.env.local` と `Constants.swift` を自動で作る。**必要な値はすべて自動検出**（手入力なし）：

| 値 | 取得元 |
|---|---|
| UDID | `xcrun devicectl list devices` |
| LAN IP / WEB_BASE_URL | `ipconfig getifaddr en0` |
| APPLE_TEAM_ID | 署名証明書の OU |
| サブスク ID | `GET /api/subscriptions` |
| USAGE_SYNC_TOKEN | `apps/web/.env`（値は非表示）|
| IOS_BUNDLE_ID | 既定 `com.subbuddy.SubBuddySpike` |

```bash
cd spikes/ios-screen-time
scripts/setup.sh          # 生成のみ（全値を自動取得）
scripts/setup.sh --run    # 生成 → preflight → 実機 E2E まで一気に
```

- `--force` 既存ファイルを上書き再生成
- 自動検出できなかった値だけ警告が出る。その場合は環境変数で上書き：
  ```bash
  APPLE_TEAM_ID=ABCDE12345 IOS_DEVICE_UDID=XXXX-XXXX scripts/setup.sh
  ```

> 手動で作る場合は `cp e2e/.env.example e2e/.env.local` と
> `cp SubBuddySpike/Shared/Constants.swift.example SubBuddySpike/Shared/Constants.swift`。

---

## 2. 毎回

```bash
# iPhone を USB 接続し、apps/web を LAN 公開で起動しておく（README Step 7）
cd spikes/ios-screen-time
scripts/run-e2e-real-device.sh
```

ビルド前に環境だけ数秒で確認：
```bash
set -a; source e2e/.env.local; set +a
scripts/preflight.sh
```

---

## 3. 失敗したら

アーティファクトは `e2e/artifacts/<日時>/` に保存される。
```bash
# Web 操作の trace を閲覧
npx playwright show-trace e2e/artifacts/<日時>/playwright-trace.zip
```
- `appium.log` … Appium サーバログ
- `xcodebuild.log` / `install.log` … ビルド・インストール
- `appium-failure.png` … 失敗時のネイティブ画面
