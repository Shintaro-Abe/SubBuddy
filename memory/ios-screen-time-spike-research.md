---
name: ios-screen-time-spike-research
description: iOS Screen Time(DeviceActivity)自動取得。実現方式調査(research/)＋Spike実施済み＝実機で認可→到達→表示の一気通貫が成立(.steering/20260606-ios-screen-time-spike, spikes/ios-screen-time)
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f473a3b-2b21-41a9-8c91-29dcb5b91de3
---

PRD 10.3 が定める「MVP 中核＝iPhone Screen Time 利用量の自動取得」の **iOS Spike 着手前の実現方式調査**を feature-research フローで完了（2026-06-05）。成果物：`research/20260605-ios-screen-time-spike/investigation.md`（外部仕様 deep-research＋既存規約 Explore＋実装戦略 Plan＋codex 反証 を統合）。

確定した実現方式：Family Controls + Device Activity を使い、FamilyActivityPicker で対象選択（不透明トークン）→ DeviceActivityMonitor 拡張が `eventDidReachThreshold` を受け → **App Group 経由で本体へ集計値** → 本体が既存 `POST /api/usage/daily` へ送る。`.individual` 認可（iOS16+）が単一ユーザー型に正解。DeviceActivityReport は描画専用で値を持ち出せない。

重要な前提・是正（反証反映）：
- **Web 側は iOS 連携を見越し済み**：usage/daily の Zod 契約・ワイヤ形式バケット(none/1m_plus..120m_plus)が Screen Time のしきい値(1/5/15/30/60/120分)と完全一致。API 契約はそのまま使える。
- MVP は **単一アプリ対象・15分以上バケット・iPhone 側で日付確定・フォアグラウンド同期主経路**に縮小（1m/5m・カテゴリ・WebDomain・複数アプリ合算・BGTask主経路は外す）。
- **Spike を go/no-go ゲート化**。最優先検証＝A1「Monitor 拡張→App Group→本体読取」が実機で安定するか。落ちたら自動同期は中止し手動記録へ縮退（中止基準を investigation.md 4.5 に明文化）。
- 既存ギャップ：`/api/usage/daily` は事前共有トークン検証が未実装（固定 user_local 返すのみ）。Spike の POST 段階で 401 検証＋`IOS_SYNC_TOKEN` 追加が必要。
- 配布には Apple 審査の distribution entitlement＋有料 Developer Program が前提（Spike は dev entitlement で可、申請方針は並行で先行）。
- 環境制約：このリポジトリは Linux コンテナで Xcode ビルド・iPhone 実機検証**不可**。Spike の実機検証はユーザーが Mac/iPhone で実施する。[[dev-env-quirks]]

次アクション（未着手）：実装に進むなら `.steering/20260605-ios-screen-time-spike/`（requirements→design→tasklist）を正式に切り、`apps/ios/` を新設。[[mvp-status]] の「次の候補」のうち本命。ジム来館の [[gym-visit-auto-import-research]] とは別系統（あちらは Shortcuts 経路・実機テスト待ち）。

**【重要・状態更新 2026-06-27】このメモは調査(pre-Spike)の記録。その後 Spike は実行済み**：`.steering/20260606-ios-screen-time-spike/` ＋ 実コード `spikes/ios-screen-time/SubBuddySpike`（DeviceActivityMonitorExtension 等、`.entitlements` に `com.apple.developer.family-controls`）。
- **完了**：dev entitlement 有効化(0-4)／`.individual` 認可成功(2-1)／FamilyActivityPicker 選択(2-2)／4閾値 startMonitoring(2-4)／`eventDidReachThreshold` 到達(2-5)／**到達→App Group→本体読取→画面表示の一気通貫(2-6)**。つまり Screen Time 経路は実機で実際に動作した（dev レベル）。
- **未検証**：多重到達(1-4)・本体/端末再起動耐性(1-5/1-6)・7日三点照合(段階4)。
- **配布**：段階7は机上完了・当面オフ（ローカルファースト＝自分のiPhoneでは配布用entitlement申請は不要。「配布見込みあり」確認済み、実申請は配布時）。
- 教訓：登壇スライドで「実機で集計値が届いた」は Screen Time でも事実。Shortcuts だけ、と誤認しないこと（[[gym-visit-auto-import-research]] の Shortcuts とは別系統）。
