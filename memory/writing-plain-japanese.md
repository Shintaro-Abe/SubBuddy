---
name: writing-plain-japanese
description: ドキュメントは平易な日本語で。専門用語・直訳調は初出に「（＝平たい説明）」を添える
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2f473a3b-2b21-41a9-8c91-29dcb5b91de3
---

ユーザーはドキュメント（特に `.steering/` の requirements/design/tasklist や `research/` の investigation）を**平易な日本語**で書くことを強く好む。直訳調・英語直訳の専門用語（例：「開いた問い」=open questions、「既知の癖」=known quirks）は意味が伝わらないと繰り返し指摘された。

**Why:** ユーザーは非エンジニア寄りの読み手で、技術文書をレビュー・承認する立場。直訳調や未説明のジャーゴンがあると内容を判断できず作業が止まる。

**How to apply:**
- 専門用語は**消さずに残し**、初出に「用語（＝平たい言い換え）」の形で括弧説明を添える（技術的正確さは保つ）。実装時に用語が消えていると困るため、用語そのものは保持する。
- 「〜である」調の硬さを避け、読み下しやすい文に。
- 直訳調を避ける：「open questions」→「まだ答えが出ていない疑問」、「known quirks」→「あらかじめ知られているおかしな挙動」など。
- 文書冒頭に「📖 この文書の読み方」を置き、用語に括弧説明を添える方針であることを明示すると親切。
- 表現を平易化しても**内容（要求・スコープ・判断基準・決定事項）は変えない**。変えるのは表現のみ。

関連：[[mvp-status]] [[ios-screen-time-spike-research]]
