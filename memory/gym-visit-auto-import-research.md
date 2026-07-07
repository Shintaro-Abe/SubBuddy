---
name: gym-visit-auto-import-research
description: エニタイム来館回数の自動取込リサーチの結論と次の前提ゲート（実機テスト待ち）
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fdac6e8-cc19-4f9d-83c2-6df84044cb4e
---

エニタイムフィットネスの来館回数を SubBuddy へ自動取込する方法のリサーチ（feature-research, 2026-06-04）。

**結論**：iOS Shortcuts「トランザクション」オートメーションが Access パス対応＋サイレント実行可。AF入館は Apple Wallet アクセスパスの NFC タッチなので、入館タッチ→オートメーション発火→ローカルAPIへ来館POST が、位置情報なし・手動なし・スクレイピングなしで実来館に1:1対応して成立する見込み（当初の「自動経路なし」結論を上書き）。

**次の前提ゲート（最優先・ユーザー実機タスク、ここで停止中）**：AFアクセスパスが「トランザクション」トリガで選択・発火するかを iPhone 実機で1回確認する。合格→実装ステアリングへ。不発→Wi-Fi近似/エクスポート/開示請求の次善策へ。

**全詳細**：`research/20260604-anytime-fitness-visit-count-auto-import/` の `HANDOFF.md`（引き継ぎ要約）、`investigation.md`(§9が最新結論)、`setup-automation-guide.md`(実機手順)、`shortcut-spec-and-api.md`(設計)。

**Why**：トークン節約のため新規セッションへ引き継ぎ。次セッションは HANDOFF.md を起点にする。
**How to apply**：実機テスト結果を受け取ったら、合格時は `.steering/[日付]-gym-visit-wallet-transaction/` を CLAUDE.md のプロセス（requirements→design→tasklist の承認ゲート）で作成して実装着手。関連：`.steering/20260601-anytime-fitness-visit-usage/`(利用量取得の意思決定)。

---

**【追記 2026-07-06｜Bluetooth 案の技術検討＝不採用（保留）】**（grill-with-docs / `.steering/20260704-testflight-sprint-roadmap/` の決定 D11）

ジム来館回数を Bluetooth 連携で自動取得できるかを検討した結果、**当面不採用（保留）**。

- **iBeacon（`CLBeaconRegion`）**：ジムが既知 UUID の公開ビーコンを設置している場合のみ背景検知が成立。エニタイムがそれを公開している事実は未確認。位置情報権限が必要で Bluetooth 単体では完結しない。
- **任意 BLE 機器の背景スキャン（`CoreBluetooth`）**：iOS は背景スキャンをサービス UUID 指定必須・低頻度に制限。入館の瞬間を確実に捉えられず来館計数に不向き。会員個人を機器接続で識別する仕組みも通常なし。
- **入館正本は NFC**：エニタイム入館は Wallet アクセスパスの NFC タッチであり、BLE ではイベントに触れない。
- **横断問題**：実用的な背景検知は結局「常に許可」相当の位置情報が絡み、SubBuddy の「集計値のみ・位置情報は集めない・追跡なし」というプライバシー訴求／App Store 審査と衝突。正確性も「近くにいた」止まりで正本に及ばない。

**優先順位**：ジム自動化を再開するなら **①Wallet トランザクション（実機ゲート1回）→ ②位置情報ジオフェンス/CLVisit → ③Bluetooth（最後）** の順。Bluetooth を先に検討する価値は低い。
**見直す条件**：エニタイムが公開 iBeacon を設置していると判明した場合のみ、iBeacon 方式を再評価する。
