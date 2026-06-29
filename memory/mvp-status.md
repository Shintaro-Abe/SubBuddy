---
name: mvp-status
description: SubBuddy Web MVP の到達点と次の候補（2026-06-04 時点）
metadata: 
  node_type: memory
  type: project
  originSessionId: f7b6d02c-94a4-465d-8503-ae78d9fb4bdd
---

SubBuddy Web（`apps/web`）の初回実装はフェーズ0〜7すべて完了し **main にマージ済み**（PR #1、#2）。E2E も追加済み（PR #2）。

- 実装済み：データモデル＋合成seed／Zod検証／ドメイン（集計・スコアリング＋段階的提供=案A・観測中）／リポジトリ（冪等upsert）／API 8本＋recompute サービス／画面6種（ダッシュボード・一覧・登録編集・詳細・レコメンド・更新間近）／README。
- 品質：unit 44 + E2E 6（Playwright・本番ビルドに対して実行＝`npm run test:e2e`）／lint／typecheck／build すべて green。受け入れ条件 AC-1〜9 達成。
- 既知の設計判断：利用ログが1件も無い契約（iCloud+ 等）は利用ベースの解約判定を出さない（[[dev-env-quirks]] とは別の仕様）。
- **デザイン刷新済み（2026-06-18）**：旧 zinc 最小UIから「静謐なエディトリアル」新デザインへ全画面刷新（[[web-ui-design-direction]] 参照）。ブランチ `feat/spending-and-design` → PR #3。支出の可視化（集計＋API＋「支出の内訳」画面）も同PRで初投入（mainには未マージ）。
- 対象外（MVP外）：iOS連携(Screen Time)／請求メール抽出／iCloud+容量管理UI／クラウド多ユーザー・認証／AI理由文生成。
- 次の候補：① UI/UX デザイン強化、② 上記 MVP外機能のいずれか、③ `wbs/wbs.yml` を実装完了に合わせて更新（WBSシート同期は現状差分ゼロ）。

注意：作業ツリーに別セッションの未コミット編集（`docs/` `wbs/` `.gitleaks.toml` 等）が残ることがある。自分の作業と混ぜてコミットしない。
