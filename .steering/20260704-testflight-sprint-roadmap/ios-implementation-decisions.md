# iPhone アプリ実装前 意思決定ログ（grill-with-docs）

> ステアリング：`20260704-testflight-sprint-roadmap`
> 作成日：2026-07-06
> 手段：`grill-with-docs`（1問ずつ確定・推奨提示）。iPhone アプリ正式実装（`apps/ios/`）に入る前の設計・意思決定。
> 入力資料：`manuals/apple-sign-in-setup.md`、`manuals/render-predeploy-setup.md`、
> `.steering/20260606-ios-screen-time-spike/stage7-main-distribution-guide.md`、`spikes/ios-screen-time/`、
> `docs/product-requirements.md` / `functional-design.md` / `architecture.md` / `glossary.md`、本ディレクトリ `roadmap.md`。
> 反映先：`docs/adr/0004〜0006`、`docs/functional-design.md`、`docs/architecture.md`、`docs/glossary.md`、
> `.steering/20260606-ios-screen-time-spike/stage7-main-distribution-guide.md`、`memory/gym-visit-auto-import-research.md`。

---

## 1. 決定ログ

| # | 決定事項 | 採用理由 | 棄却した案 | 見直す条件 |
|---|---|---|---|---|
| D1 | `apps/ios/` は「本体アプリ＋DeviceActivityMonitor Extension」の2ターゲット。Bundle ID＝`com.subbuddy.app`／`com.subbuddy.app.monitor`、App Group＝`group.com.subbuddy.app`、Services ID＝`com.subbuddy.web`。Extension に Sign in with Apple は付けない。Shield/ManagedSettings UI・Shortcut Extension は v1 では作らない | 既存 manuals・Spike・TestFlight 方針が一致。最短で申請/実装可能 | Bundle ID 変更／Extension 以外も追加 | ブランド都合で ID を変える必要が出た時 |
| D2 | iOS はネイティブ Sign in with Apple。サーバー検証は `aud` 許可リスト方式で Web（`com.subbuddy.web`）と iOS（`com.subbuddy.app`）両方を許可。iOS 用は `POST /api/auth/apple/native`（Web コールバックと分離）。`sub` ハッシュで users 解決、メール非必須 | 審査に強く UX 良。Web/iOS を同一 users に集約。検証の穴を作らない | Web OAuth を iOS で流用／iOS 用 users を別名前空間化 | Apple 仕様変更、対応プラットフォーム追加 |
| D3 | デバイス登録は「1端末=1レコード」で冪等。sync token は iOS Keychain 保存。失効・再発行は Web の `DELETE /api/devices/{id}` に集約。iOS 内に失効 UI は作らない | 最小実装で秘密情報方針を満たす | iOS 内デバイス管理 UI／token を App Group 平文保存 | 複数端末運用が主要要件化した時 |
| D4 | 送信はフォアグラウンド化時に自動 `syncAll`。冪等は `(subscription_id, usage_date)` upsert＋バケット最大値マージ。当日分は消さず、過去日かつ送信成功のみ削除。日付は iPhone 現地時刻で確定しサーバーは変換しない | 当日取りこぼし防止・重複安全・7日計測に耐える | 送信後全削除（Spike のまま）／前日分のみ送信 | 背景送信を導入する時 |
| D5 | 配布関連の文面（プライバシーポリシー・App説明・Family Controls 回答・App Privacy 申告）を cloud-testflight（クラウド送信）に統一。「Mac にだけ送る」は local mode 説明限定 | 実態と申告の一致（審査リスク回避） | 現状文面のまま提出／local mode 相当で配布 | production mode で保存方式を強化する時 |
| D6 | サブスク↔計測対象アプリの対応付けは iOS 上のユーザー手動選択が正。bundleId 自動突合はしない（`FamilyActivityToken` 不透明）。カタログ `app_bundle_ids` は候補ヒントに格下げ。1サブスク=1計測対象アプリ | トークン不透明性と整合、PII 最小化、Spike 資産活用 | サーバー bundleId 自動突合（技術的に不可）／複数アプリ合算 | 複数アプリ合算が必須要件化した時 |
| D7 | アカウント削除を iOS アプリ内に用意し、サーバーは当該 `user_id` の全データをカスケード物理削除（`DELETE /api/account`）。デバイス失効とは別導線 | App Store 5.1.1(v) 必須。機微データ方針と整合 | Web のみ削除／論理削除のみ | 監査・法務要件の追加時 |
| D8 | TestFlight 提出可否ゲート＝一気通貫・7日連続計測・テナント分離・冪等・配布署名(entitlement 同梱)・アカウント削除・プライバシー整合・秘密情報非漏洩。外部配布は Beta App Review 通過を追加 | 提出前に事故要因を全て潰す | 一気通貫と7日のみ／内部テストで妥協 | 提出運用が安定し省略可能と判断した時 |
| D9 | 実装順序は「一気通貫を最短化→開発実機で7日連続計測を即開始→残りをクラウド/認証/削除/文面と並行」 | 圧縮不能ゲート（7日）を先に消化し期日リスク最小 | クラウド完成後に計測開始／週割り据え置き | 大きな設計変更が発生した時 |
| D10（状態更新） | 配布用 Family Controls entitlement は本体・Extension 両方とも審査完了済み。クリティカルチェーンから審査待ちを削除。以後の遅延は実装遅れ扱い | 事実。最大の外部依存が解消 | — | 追加 Bundle ID を作る時は再申請 |
| D11（保留） | Bluetooth によるジム来館取得は不採用（近似止まり・位置権限が絡みプライバシー訴求と衝突・エニタイムは NFC 入館で BLE 非対応）。ジム自動化の優先は Wallet→位置情報→Bluetooth の順 | 正確性・実現性・プライバシーで既存案に劣る | Bluetooth 先行検討 | エニタイムが公開 iBeacon を設置と判明した時 |

## 2. ADR（`docs/adr/`）

- ADR 0004：Apple サインインの token 検証を aud 許可リスト方式にする（D2）
- ADR 0005：計測対象アプリの対応付けはユーザー手動、bundleId 自動突合はしない（D6）
- ADR 0006：利用量同期の冪等はバケット最大値マージ＋当日レコード非削除（D4）

## 3. 用語差分（`docs/glossary.md` へ反映済み）

- 新規：計測対象アプリ（Measured App）＝サブスクに対応する既存アプリ。SubBuddy 本体アプリとは別物。
- 新規：SubBuddy 本体アプリ（Host App）。
- 新規：デバイス失効／アカウント削除の区別、`usage_date` の権威（端末側確定）。
- 意味変更：`app_bundle_ids` は自動突合の正本ではなく候補ヒント。

## 4. 実装前チェックリスト

### iOS アプリ（apps/ios）
- [ ] 2ターゲット構成・Bundle ID・App Group・Services ID を D1 どおり設定
- [ ] Spike 移植：認可／Picker／対応付け／監視登録／Extension／送信
- [ ] 送信ロジックを D4 に修正（max・過去日のみ削除・端末側日付）
- [ ] 対象は `active_foreground`/`active_background` のみ表示、未対応サブスクを可視化

### DeviceActivity / FamilyControls / App Group
- [ ] `.individual` 認可、再要求しない状態復元
- [ ] 閾値 15/30/60/120 分、現地時刻 0:00–23:59
- [ ] Extension は通信しない（App Group 書き込みのみ）
- [ ] 対応表・selection は端末ローカル限定（Mac/クラウドへ送らない）

### 起動シグナル（Shortcuts 由来）
- [ ] ネイティブアプリに吸収。外部ショートカットを v1 主経路にしない
- [ ] `ios_shortcut` source 値は互換のため残置

### Apple サインイン
- [ ] iOS ネイティブ Sign in with Apple
- [ ] サーバー `aud` 許可リスト（web/app）＋`iss` 検証（ADR 0004）
- [ ] iOS 用エンドポイント（`/api/auth/apple/native`）を Web と分離
- [ ] `sub` ハッシュで users 解決、メール非必須

### device sync token
- [ ] サインイン直後に冪等デバイス登録
- [ ] iOS は端末内生成の `clientDeviceId`（UUID）を Keychain 保存し、登録時に送る。サーバーは `(user_id, client_device_id)` で upsert
- [ ] token は Keychain 保存（App Group 平文に置かない）
- [ ] サーバーは `token_hash` のみ保存、平文をログ/DB に残さない
- [ ] `POST /api/usage/daily` は token から user 解決、body の user_id 無視

### cloud-testflight mode
- [ ] `SUBBUDDY_MODE=cloud-testflight`、Render 事前設定（DB internal URL・secret）
- [ ] テナント越え防止テスト（別 user token で他人データ不可）
- [ ] Web の Apple サインイン導線
- [ ] ログに PII/secret を出さない

### TestFlight / entitlement
- [ ] 本体・Extension とも配布 entitlement 承認済み（D10：確認済）
- [ ] 配布プロビジョニング2種で Archive
- [ ] codesign で両方に `family-controls`＋`application-groups` 確認
- [ ] 内部テスト→Beta App Review→外部20〜50人
- [ ] 開発実機＋開発 entitlement で7日連続計測を先行完了

### プライバシー・削除導線
- [ ] `DELETE /api/account`＋全テーブルのカスケード物理削除
- [ ] iOS 内アカウント削除 UI、削除後に Keychain/App Group をローカル消去
- [ ] プライバシーポリシー/App説明/App Privacy/Family Controls 回答を cloud 送信で統一（D5）
- [ ] 問い合わせ導線（サポート URL）を用意
- [ ] 中立表現（煽らない）を UI/文面で維持

## 5. 既知の是正（Spike → 正式移植）

- `spikes/ios-screen-time/SubBuddySpike/App/UsageSyncService.swift` の `syncAll()` は送信後に当日分も削除する既知欠陥。正式版では当日分を残し、過去日かつ送信成功のみ削除する（ADR 0006）。
- サーバー `POST /api/usage/daily` の upsert を「後勝ち」から「バケット最大値マージ」に実装変更する（要現行実装確認）。
- `docs/functional-design.md` の「bundleId/domain 突合」記述は候補ヒントへ是正済み（ADR 0005）。

## 6. ロードマップへの影響（`roadmap.md`）

- entitlement 本体・Extension とも審査完了済みのため、クリティカルチェーンの「審査待ち」ゲートは解消（D10）。7日連続計測を最優先で先行開始する（D9）。
- スリップの正当理由だった「entitlement 審査待ち」は消滅。以後の遅延は実装遅れとして管理する。
