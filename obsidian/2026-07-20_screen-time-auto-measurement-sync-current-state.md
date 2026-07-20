---
title: Screen Time自動計測・自動同期の現行状態
date: 2026-07-20
status: current
applies_to:
  - cloud-testflight
  - ios-app
---

# Screen Time自動計測・自動同期の現行状態

## 結論

現行iPhoneアプリでは、Screen Time認可済みの利用者が有効な契約へ計測対象アプリを1つ対応付けると、自動で計測を開始する。利用者向けの開始・停止操作はない。本体アプリの起動、Appleサインイン完了、フォアグラウンド復帰時に端末内の日別集計を自動同期する。

## 現行データフロー

1. `DeviceActivityMonitor Extension`が15分/30分/60分/120分の到達を検知する。
2. App GroupへActivity IDと現地日付単位の日別集計を保存する。詳細な操作履歴やアプリ一覧は保存・送信しない。
3. 本体アプリの自動同期がActivity IDを契約IDへ対応付け、変更・解除処理中の契約を除外する。
4. APIがデバイス同期トークンから利用者を特定し、契約の所有権を検証する。
5. DBの`ios_usage_daily_summaries`へ`subscription_id × usage_date`でupsertする。同日再送では大きい利用段階を残す。

APIの利用段階は`15m_plus`等、DB内部表現は`m15_plus`等である。DBでは`user_id`でアカウント、`subscription_id`で契約を仕分ける。

## ライフサイクル

- 対象変更: 旧監視を停止し、対象契約の端末内・DB上の旧利用量と旧見直し結果を削除してから新対象を自動開始する。
- 対応付け解除: 監視と対象契約の計測データを削除する。料金・更新日等の契約情報は残す。
- 契約削除: 契約に属する監視、対応付け、利用量、見直し結果も削除する。
- 認可取消: 対応付けと過去集計は保持し、再認可後に自動再開する。
- 通信失敗: 未送信集計を保持し、次回の起動・サインイン・復帰時に再試行する。

## 表示と運用上の境界

- iPhoneの`設定 > 同期`で最終同期確認、未送信件数、失敗状態を確認できる。
- `今すぐ同期`は通常操作ではなく、確認・復旧用である。
- 同期成功は日別集計のDB保存を意味する。通常同期後の見直し再計算は自動ではないため、最新集計を見直しへ反映するにはiPhoneまたはWebで再計算する。
- Render DBの確認方法は`manuals/render-screen-time-usage-db-query.md`を正とする。実値や識別子はメモへ転記しない。

## 未確認・未実装

- 日をまたぐ連続利用の配分と7日連続計測は実機確認が残る。
- Mac Simulatorでは署名付きテストホストの再実行が残る。
- 利用量同期成功後の見直し自動再計算は未実装である。

## 現行コード参照

- `apps/ios/SubBuddyApp/App/MeasurementSession.swift`
- `apps/ios/SubBuddyApp/App/MonitorScheduler.swift`
- `apps/ios/SubBuddyApp/App/UsageSyncService.swift`
- `apps/ios/SubBuddyApp/App/ContentView.swift`
- `apps/web/src/app/api/usage/daily/route.ts`
- `apps/web/src/repositories/usage.ts`
- `apps/web/src/app/api/subscriptions/[id]/usage/route.ts`
- `apps/web/src/repositories/measurement-data.ts`
