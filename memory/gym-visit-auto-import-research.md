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
