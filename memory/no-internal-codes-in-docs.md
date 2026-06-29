---
name: no-internal-codes-in-docs
description: 他人に見せるドキュメントには P1 等の内部項番・コードを書かず、内容を表す名前で表現する
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 63bdbcd0-cfe5-48ef-9f2e-63d5f6705045
---

他の人に見せる説明資料では、P1〜P7 のような内部の項番・識別コードを本文に含めない。

**Why:** 項番は実装・仕様書内の整理用であり、初見の読者には意味が伝わらず読み手にコード対応表の参照を強いるため。

**How to apply:** 外部向け・共有用ドキュメントでは項番の代わりにパターン名・内容を表す日本語名（例：「使っていない」「重複で割高」）で通す。コード・仕様書への参照が必要なら末尾の参照元欄に留める。[[writing-plain-japanese]] と同系統の方針。
