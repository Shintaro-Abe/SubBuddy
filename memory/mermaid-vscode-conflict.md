---
name: mermaid-vscode-conflict
description: VS Code 1.61以降はMermaidを標準描画する。bierner.markdown-mermaid拡張が入っていると競合して「No diagram type detected」エラーで描画されない。拡張を無効化すれば直る。
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bb5b3b0c-aeea-4c64-8138-937ab632ad02
---

VS Code 1.61 以降は Markdown プレビューに Mermaid のレンダラが**組み込まれている**。`bierner.markdown-mermaid` 拡張は旧版向けの補助であり、新しい VS Code では**競合して「No diagram type detected」エラーを出す**。

**Why:** 2026-06-07 に harness-map.md のインライン Mermaid が Mac ローカル・Dev Container 両方で描画されず、原因切り分けに長時間を要した。最終的に拡張を無効化/アンインストールすることで即座に描画された。

**How to apply:** Mermaid が描画されない報告を受けたら、まず `bierner.markdown-mermaid` の無効化を案内する。VS Code 1.61 以降では拡張は不要であり、むしろ害になる。`harness-map.md` §0.5.1 にもこの注意を記載済み。
