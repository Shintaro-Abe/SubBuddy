# 機能実装の調査・戦略立案 Skill — タスクリスト（tasklist）

> ステアリング：`20260603-feature-research-skill`
> ドキュメント種別：作業単位ドキュメント（`.claude/.steering/`）
> 作成日：2026-06-03
> 前提：`requirements.md` / `design.md` 承認済み。codex（`codex@openai-codex` v1.0.4 / ログイン済み）実働可能。
> 不変条件：**本作業はアプリ機能コードを実装・変更・コミットしない**。成果物は調査フローの Skill 化のみ。

---

## 凡例
- [ ] 未着手 / [~] 進行中 / [x] 完了

---

## T1. 事前準備・前提確認
- [ ] T1-1. codex 実働確認（`codex login status` = Logged in）※済（design §7.1）
- [ ] T1-2. 依存能力の存在確認（`deep-research` / `Explore` / `Plan` / `codex:rescue` / `knowledge-scribe`）
- [ ] T1-3. 既存 Skill との名前衝突がないこと（`feature-research` 未使用）を確認
- **完了条件**：依存と命名の前提が揃い、SKILL.md 作成に着手できる

## T2. Skill 本体（SKILL.md）の作成
- [ ] T2-1. `.claude/skills/feature-research/SKILL.md` を新規作成
- [ ] T2-2. frontmatter（`name` / `description`）を design §3 のとおり記述（起動トリガー語＋「実装・コミットしない」境界を含む）
- [ ] T2-3. 冒頭に**不変条件**（調査・戦略のみ／実装・コミット禁止／verify・run はスコープ外）を明記
- [ ] T2-4. 入力仕様（design §4）：機能名あり／なし（1問だけ対話確認）／曖昧時のスコープ絞り込み
- [ ] T2-5. 5ステップのフロー（design §5：Step0 ガード → deep-research → Explore → Plan → codex:rescue → knowledge-scribe）を、各ステップの目的・入力・期待アウトプットとともに記述
- [ ] T2-6. PII・機微データガード（design §7：`~/.codex`・`.env`・`secrets/`・実データ不参照、外部送信は一般技術情報のみ）を記述
- [ ] T2-7. 縮退動作（design §8：codex 未ログイン時は反証スキップ＋信頼度留保、依存不在の明記）を記述
- [ ] T2-8. 成果物の保存先（`research/[YYYYMMDD]-[テーマ]/investigation.md`）と investigation.md 雛形（design §6 の8章構成）を記述
- [ ] T2-9. 完了時の振る舞い（design §9：実装していない旨・成果物パス・次アクションの提示）を記述
- **完了条件**：AC-1〜AC-6, AC-9 を満たす SKILL.md が存在する

## T3. 検証（動作・規約）
- [ ] T3-1. `claude plugin validate`（または `claude` 再起動）で Skill が認識・起動可能か確認
- [ ] T3-2. frontmatter の YAML が妥当（パースエラーなし）であることを確認
- [ ] T3-3. SKILL.md に実 PII・資格情報・実データが含まれないことを確認（pre-commit-secret-scan 観点）
- [ ] T3-4. アプリ機能コード（`apps/web/` 等）・`docs/` に変更が発生していないこと（`git status` で差分が `.claude/` と `research/`・本ステアリングに限定）を確認 ※AC-7
- **完了条件**：Skill が起動でき、規約違反・実データ混入がない

## T4. ドライラン（任意・実装なしの範囲で）
- [ ] T4-1. ダミーの機能スコープ（例：合成データを用いた軽量テーマ）で `/feature-research` を1回試行し、フローが「調査・戦略のみ」で完結し `research/` にレポートが出ることを確認
- [ ] T4-2. ドライランで作った試行レポートは破棄 or サンプルとして残すかを判断
- **完了条件**：Skill が想定どおり調査フローを回し、実装に踏み込まないことを実地確認
- **備考**：T4 はユーザー承認を得てから実施（トークン消費・外部検索が発生するため）

## T5. 仕上げ・記録
- [ ] T5-1. `.gitignore` 方針の決定を反映（`research/` をコミット対象に含める／除外する）※design §12-1
- [ ] T5-2. 必要なら `docs/repository-structure.md` に `research/` ディレクトリの役割を追記（恒久ドキュメント影響の判断）
- [ ] T5-3. 本ステアリングの各 md の状態を最終化（承認済みに）
- [ ] T5-4. コミットはユーザー指示があった場合のみ（pre-commit-secret-scan を先に実行）
- **完了条件**：成果物が確定し、リポジトリ方針と整合している

---

## 受け入れ条件（AC）対応マップ
| AC | 担保タスク |
|---|---|
| AC-1 Skill 認識・起動 | T2-1, T2-2, T3-1 |
| AC-2 不変条件明記 | T2-3, T2-9 |
| AC-3 5ステップ定義 | T2-5 |
| AC-4 PII 方針参照 | T2-6, T3-3 |
| AC-5 機能名入力 | T2-4 |
| AC-6 保存先ルール | T2-8 |
| AC-7 アプリコード非変更 | T3-4 |
| AC-8 codex 導入手順 | requirements §7（完了済み）, T1-1 |
| AC-9 未ログイン縮退 | T2-7 |

---

## 未確定事項（着手前にユーザー確認）
1. `research/` の Git 管理方針（コミット対象 or `.gitignore` 除外）— T5-1。
2. T4 ドライランを実施するか（実施する場合の対象テーマ）。
3. `docs/repository-structure.md` への `research/` 追記要否 — T5-2。

---

## 進め方の確認（次アクション）
- 本 tasklist 承認後、**T1 → T2（SKILL.md 作成）** に着手する。
- T4（ドライラン）・T5-4（コミット）は**それぞれ個別にユーザー承認**を得てから実施する。
