# レビューパック — TestFlight 向けサーバー側整備（iOS 接続前）

> 後追い作成（2026-07-07 実施分の記録）。実装は完了・検証済み。本書は事後の記録・確認用。

## 区分

- [ ] 軽量
- [x] フル（`docs/`・スキーマ・API に触れる）

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)
- 決定の親：`../20260704-testflight-sprint-roadmap/ios-implementation-decisions.md`（ADR 0004〜0006 / D1〜D11）

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 max マージ | usage-bucket rank / mergeUsageDaily / usage repo | T-1 | 検証済（単体＋実DB） |
| AC-2 aud 許可リスト | apple-auth allowedClientIds | T-2 | 検証済（単体） |
| AC-3 native endpoint | api/auth/apple/native | T-3 | 検証済（build 出力） |
| AC-4 デバイス冪等 | schema/unique・services upsert・devices route | T-4,T-5 | 検証済（実DB） |
| AC-5 アカウント削除 | api/account・deleteAppleUserAccount | T-6 | 検証済（実DB） |
| AC-6 health | api/health | T-7 | 検証済（build 出力） |
| AC-7 migrate deploy | migration 20260707093000 | T-4 | 検証済（空DB適用） |
| AC-8 手順書整合 | render manual md/html・docs・.env.example | T-8,T-11 | 反映済 |
| AC-9 build/CI | layout/globals font 修正 | T-10 | 検証済（build/lint/typecheck/test） |
| AC-10 テナント越え防止 | usage repo 所有チェック | T-1,T-9 | 検証済（実DB） |

> 漏れ・孤立の有無：なし。全 AC にタスクと検証が対応。

## 前提・未決事項

### 要ユーザー判断（解決状況）

- [x] Q-1: フォント方針 → **当面 system fallback を維持**（Render 投入優先）。デザイン厳密化が必要になったら `next/font/local`＋自ホスト（ライセンス確認）へ切り替える後続タスクとする。
- [x] Q-2: コミット範囲 → 精査の結果、未コミット差分は「ネイティブ iPhone アプリ＋クラウド送信」への統一という**単一ワークストリームで整合**していたため、gitleaks クリーン確認後に**一括コミット**（`36bd910`）し `origin/main` へ push 済み。

### 設計上の前提

- 前提1: 送信は集計値のみ。`client_device_id` は端末生成 UUID（PII でない）。
- 前提2: Web/iOS は同一 users に集約（ADR 0004）。
- 前提3: `usage_date` の権威は端末側（ADR 0006）。

## 影響範囲

- `docs/` への影響 / 更新案: `functional-design.md`・`architecture.md` 更新済み。ADR は親ステアリングで作成済み。
- 既存コード・機能への影響: `registerDeviceForAppleUser` シグネチャ変更（呼び出し・テスト更新済み）。表示フォントが system 依存に変化。
- マイグレーション・後方互換: 新規1件・additive。既存フローは後方互換。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| セキュリティ/プライバシー | token 平文保存・PII 流出リスク | token は hash 保存・body の user_id 無視・health は secret 非返却・検証は合成データ |
| アーキ | upsert の原子性（読取→書込のレース） | TestFlight 規模で許容。必要時 raw SQL GREATEST へ移行可能と明記 |
| QA | fake テストが実挙動を隠す恐れ | 実 DB 通し検証スクリプトを追加し全項目 PASS |
| PM | スコープ膨張 | iOS 本体・実デプロイ・フォント自ホストは非スコープに明記 |

### 第二意見（フル区分は必須）

- 手段: セルフ・アドバーサリアルレビュー（別ペルソナ：セキュリティ／アーキ／QA）。
- 要点: max マージのレース・fake の網羅性・フォント副作用。
- 反映した内容: 実DB検証の追加、raw SQL 移行余地の明記、フォント副作用の申し送り化。

## 承認

- [x] 未決事項ゼロを確認（Q-1・Q-2 解決済み）
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 実装・検証は完了済み（本書は事後記録）
- [x] コミット・push 済み（`36bd910` → `origin/main`）
