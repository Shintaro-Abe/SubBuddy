---
name: ios-shortcut-launch-signal-research
description: iOS Shortcut起動シグナル連携の調査結論＝条件付きGo。前面起動検知に限定・recency補助のみ・実機HTTPゲート待ち
metadata: 
  node_type: memory
  type: project
  originSessionId: ed3fa0ae-1147-4f14-a9ec-f2ccb310599a
---

iOS Shortcuts「App→Is Opened」で背景再生アプリ起動を検知し利用シグナル(used:true, source:ios_shortcut)を自宅MacのローカルAPIへ自動送信する方式の feature-research（2026-06-19）。成果物：`research/20260619-ios-shortcut-launch-signal/investigation.md`（deep-research 17ソース→15確証/10棄却＋codex反証）。

**結論＝条件付きGo**：
- サイレント自動実行は出典で成立（iOS14+ Ask Before Running OFF、15.4+ 通知バナー抑止、17+ Run Immediately）。「自動実行でも必ず通知」説は0-3棄却。
- Web受信側はスキーマ変更不要。`used:true`+`usageBucket:"none"`(=0分/時間不明)+`source:"ios_shortcut"` を送れば aggregateUsage の `daysSinceLastUse` が更新されP1に反映。source enum に ios_shortcut は既に定義済み（`schemas/usage.ts:22`）。同日複数起動は (subscriptionId,usageDate) 冪等upsertで1日1件に収束。
- **重大な意味的限界（codex反証）**：`Is Opened` は前面起動のみ発火＝背景再生(ロック画面/CarPlay)は取りこぼす。→「検知あり=最近触った(recency更新)」に使うのは可。**「検知なし=使ってない」と断定して解約候補に直結はNo-go**。背景再生型はシグナル欠如を強い根拠にしない。

**必須の実機ゲート（ユーザーがMac/iPhoneで実施・Claude不可）**：ローカルIP宛プレーンHTTP POSTがShortcutsから通るか（ATSはLAN IPに非適用で見込みありだが出典未確証）。Macのbind先(localhostのみでないか)・ローカルネットワーク許可・ファイアウォール・端末ローカル日付。

**Why**：起動回数連携の実現方式を確定。回数(count)は不採用＝利用シグナルのみ（ユーザー決定）。
**How to apply**：実機ゲートGoなら root `.steering/[日付]-ios-shortcut-launch-signal/` を requirements→design→tasklist の承認ゲートで起こし、正規形のテスト固定＋field-test-guide作成。関連：[[ios-screen-time-spike-research]]（時間計測の本命・別系統）、[[gym-visit-auto-import-research]]（Wallet実機テスト待ち）、[[quantitative-recommendation-engine]]（P1判定）。
