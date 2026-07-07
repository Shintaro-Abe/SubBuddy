# レビューパック — TestFlight iOS 実装

> このファイル1枚で、`requirements.md` / `design.md` / `tasklist.md` をまとめて承認する。

## 区分

- [ ] 軽量（バグ修正・小改修。基本設計に触れない）
- [x] フル（新機能・`docs/` に触れる変更。第二意見必須）

`apps/ios/` の正式実装を開始する新機能であり、DeviceActivity・Apple サインイン・配布 entitlement・アカウント削除を含むためフル区分。

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)
- 親ロードマップ: [`../20260704-testflight-sprint-roadmap/roadmap.md`](../20260704-testflight-sprint-roadmap/roadmap.md)
- iOS 実装前決定: [`../20260704-testflight-sprint-roadmap/ios-implementation-decisions.md`](../20260704-testflight-sprint-roadmap/ios-implementation-decisions.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 | 2ターゲット構成 | T-1 | 未着手 |
| AC-2 | Bundle ID / App Group / Services ID / signing | T-1, T-2 | 未着手 |
| AC-3 | Sign in with Apple API client | T-3 | 未着手 |
| AC-4 | device 登録と Keychain 保存 | T-4 | 未着手 |
| AC-5 | FamilyControls 認可・Picker・監視登録 | T-5, T-6 | 未着手 |
| AC-6 | Extension は App Group 書き込みのみ | T-7 | 未着手 |
| AC-7 | フォアグラウンド同期・過去日のみ削除 | T-8 | 未着手 |
| AC-8 | 集計値限定 payload | T-5, T-7, T-8 | 未着手 |
| AC-9 | アカウント削除 UI とローカル消去 | T-9 | 未着手 |
| AC-10 | 実機一気通貫 | T-10, T-12 | 未着手 |
| AC-11 | Archive / codesign entitlement 確認 | T-2, T-11 | 未着手 |
| AC-12 | build / 検証 / secret 非漏洩 | T-11, T-12 | 未着手 |

漏れ・孤立の有無: なし。全 AC に対応設計とタスクがある。AC に紐づかないタスクなし。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- なし

### 設計上の前提（崩れると設計が変わるもの）

- Family Controls entitlement は本体・Extension とも承認済み。
- サーバー側整備は `../20260707-testflight-backend-readiness/` で完了済み。
- iOS build / Archive / codesign は Mac/Xcode 上で実施する。
- 実在の個人データは扱わず、確認は合成データと開発実機に限定する。
- Render 実デプロイと Apple Developer 実設定は並行外部作業として残る。

## 影響範囲

- `docs/` への影響 / 更新案: 現時点では基本設計に反映済み。実装中に差分が出た場合のみ `functional-design.md` / `architecture.md` / `glossary.md` を更新する。
- 既存コード・機能への影響: `apps/ios/` 新設が中心。既存 Web/API は原則変更なし。
- マイグレーション・後方互換: DB migration は不要見込み。local mode の同期互換は維持。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| PM | 画面を作り込みすぎると7日連続計測開始が遅れる | 一気通貫を最短化し、UI は必要最小限に限定 |
| アーキテクト | Extension が通信すると責務と審査説明が複雑になる | Extension は App Group 書き込みのみ。本体アプリが同期 |
| セキュリティ / プライバシー | token や詳細ログの漏洩が最大リスク | token は Keychain、payload は集計値のみ、secret scan とログ確認を完了条件に追加 |
| QA | DeviceActivity は実機・日跨ぎで壊れやすい | 一気通貫後に7日連続計測ログを tasklist に残す |

### 第二意見（フル区分は必須）

- 手段: 別ペルソナによるアドバーサリアル・セルフレビュー（PM / アーキテクト / QA / セキュリティ・プライバシー）
- 要点: 7日計測の開始遅れ、Extension 通信、token 保存、payload 過多、codesign 見落としが主要リスク。
- 反映した内容: T-7 / T-8 / T-11 / T-12 と AC-6 / AC-8 / AC-11 / AC-12 を明示。

## 承認

- [ ] 未決事項ゼロを確認
- [ ] トレーサビリティ表に漏れ・孤立なし
- [ ] 上記をもって requirements / design / tasklist をまとめて承認
