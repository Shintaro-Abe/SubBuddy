---
name: icloud-capacity-acquisition-research
description: iCloud+容量の取得方式調査。自動取得は正規API無し→手動入力主＋OCR/請求逆引き補助で確定
metadata: 
  node_type: memory
  type: project
  originSessionId: c9a6e5cd-89d7-4b6e-a2cb-966265feae5a
---

iCloud+（capacity 軸）の容量取得方式を出典付きで調査し確定（2026-06-21、`research/20260621-icloud-capacity-acquisition/investigation.md`）。

**結論**：iCloud アカウント全体の容量/使用量を取る**公開・正規 API は存在しない**（Foundation はローカル容量のみ／CloudKit は自アプリ枠＋quotaExceeded エラーのみ／公開 Web API 無し、Apple 公式は GUI 目視のみ）。pyicloud は非正規スクレイピングで ToS/BAN・SRP-6a 破綻・資格情報を扱う＝不採用。

**取得方式**：手動入力を主（プラン容量＝選択式・使用容量＝数値、無料枠5GBは定数で入力させない）／補助1 スクショOCR（候補→ユーザー確認→保存の3段、フェーズ2）／補助2 請求メール逆引き（金額→プラン容量のみ、使用量は不明）。

**設計の中心軸（codex 反証）**：自動取得不可ゆえ判定精度は信頼度(confirmedByUser)・鮮度(capturedAt)・スコープ(usageScope/costScope 個人か家族全体か)に依存。容量は専用スナップショットテーブル＋時系列で保持。「下位プランで足りるか」は usedCapacity+safetyBuffer<lowerPlan＋鮮度必須＋境界保留。UsageType="capacity" は既存・P1〜P6時間軸には不干渉。

他の取得源調査と同列：[[ios-screen-time-spike-research]] [[gym-visit-auto-import-research]] [[ios-shortcut-launch-signal-research]] [[quantitative-recommendation-engine]]
