---
name: procedure-guide-skill
description: 手順書生成スキル procedure-guide の仕様。初学者向けMD(SSOT)＋単一HTML(コピーボタン付)を生成。MDのbashフェンス=コピー単位
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83e49d17-d80e-4c39-a5e8-dbda442104fe
---

ローカル自作スキル `.claude/skills/procedure-guide/`。初学者向けの手作業手順書を作る。

**成果物:** MD（正・SSOT、人が編集）＋ HTML（`assets/md2guide.mjs` でMDから生成、単一ファイル完結・オフライン可・コピーボタン付）。HTMLは手書きせず必ず再生成。

**変換規約（MD→HTML、`md2guide.mjs` が解釈）:**
- ` ```bash/sh/shell/zsh/console ` フェンス1つ = **コピー単位（1ボタン=1シェル実行=Enter1回）**。連続コマンドは一気に実行してよいものだけ && 連結。ブラウザ起動/出力確認を挟むものは分割。
- 他言語フェンス（```json 等）= 表示のみ（コピー不可）。
- 番号付きリスト = GUI手順（コピー不可、丸番号バッジ表示）。
- `> ⚠ ...` = ミス注意 callout、`> ✅ ...` = 確認 callout。
- 見出し/箇条書き/GFM表/水平線/インライン(`code`/**bold**/[link]) 対応。

**ステップ書式:** ○目的一言 → □操作 → ⚠ミス注意(必要時) → ✅確認。

**変換器:** Node zero-dependency ESM。`node assets/md2guide.mjs <in.md> [out.html]`（省略時 同名.html）。コピーは navigator.clipboard＋execCommandフォールバック、成功時「コピーした✓」。デザインは [[web-ui-design-direction]] の静謐トーン（セージ緑＋オフホワイト＋明朝見出し）をCSSインライン。

**実装の注意（既知の落とし穴）:** inlineコード退避のplaceholderは `@@CODE<n>@@`（NUL や ` <数字> ` だと本文の数字と衝突 or NULがソースに混入する）。

2026-06-27 作成・検証済み（[[slide-deck-dojo-workstream]] のsetup手順書をHTML化する用途が初出）。
