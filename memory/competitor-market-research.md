---
name: competitor-market-research
description: 同業他社サブスク管理アプリの市場調査（出典付き）。利用量ベース解約判定は業界前例ゼロを確認＋codex反証で戦略を「意思決定支援」に再定義
metadata: 
  node_type: memory
  type: project
  originSessionId: ff35d04c-b000-4515-874d-714d86fb1c32
---

サブスク管理・解約レコメンド系アプリの市場調査を `/feature-research`（deep-research→Explore→Plan→codex反証→記録）で実施。成果物：`research/20260607-subscription-app-market-research/investigation.md`（出典付き・23 claims confirmed）。

確定した発見：
- **利用量(Screen Time/利用時間/頻度)ベースの解約判定は業界前例ゼロ。** Rocket Money/Truebill, Trim, Monarch, マネーフォワードME, Wallos すべて「明細パターン検出」か「手動登録」が判定基盤。→ [[usage-recommendation-validity-research]] と [[recommendation-axes-strategy-research]] を出典付きで裏付け。
- **技術裏付け：** Screen Time/DeviceActivity API は対象アプリID(bundleId/表示名)を暗号トークンで隠蔽(ApplicationToken=nil)。ただしユーザーが選択したトークンのしきい値イベント発火は取得しうる(=SubBuddy設計の方式)。
- **能動的「解約すべき」判定を持つアプリも皆無**＝各社は「忘れられたサブスクの支出可視化」止まり。
- **自動検出(Plaid明細連携)が主流**、手動登録は例外。ローカルファースト前例はWallos(自己ホスト)のみで市場性未検証。

**Why:** SubBuddyの中核仮説「利用量×ルールベースで解約判定」は市場・技術の両面で前提が崩れている。

**How to apply:** ①利用量は中核から降ろし補助シグナルへ。②ただし降格しただけだと「プライバシー重視の手動台帳」化する(codex反証「要修正」)→中核を「サブスク見直しの意思決定支援(優先度・理由・次アクション提示)」に再定義。③前例ゼロはブルーオーシャンでなく未検証ニッチ＝小さい強い痛みの層で継続利用を検証。④手動登録のみが最大の事業リスク。明細連携(恒久禁止)≠入力補助で、ローカルCSV/メール抽出/OCRを早期検証。⑤iOS Spikeは短期3問に縮小。⑥成功指標は登録件数でなく見直し完了数/実行数/再訪率/納得率。MVPは実装済みのため多くはconfig(scoring.ts)調整＋UIコピー＋PRD/機能設計の改訂(別ステアリング・段階承認)で吸収可能。
