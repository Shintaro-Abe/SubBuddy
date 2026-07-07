# レビューパック — クラウド認証境界設計

> このファイル1枚で、requirements / design / tasklist をまとめて承認する。

## 区分

- [ ] 軽量（バグ修正・小改修。基本設計に触れない）
- [x] フル（新機能・`docs/` に触れる変更。第二意見必須）

クラウド化、認証、テナント分離、iPhone 同期 API の境界に触れるため**フル区分**。

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 実行モード差分 | D-1 | T-1 | OK |
| AC-2 内部認証モデル | D-2 | T-2 | OK |
| AC-3 認証 provider 境界 | D-3 | T-3 | OK |
| AC-4 `USAGE_SYNC_TOKEN` 整理 | D-4 | T-4 | OK |
| AC-5 iPhone 同期のユーザー解決 | D-5 | T-5 | OK |
| AC-6 テナント分離とテスト方針 | D-6 | T-6, T-7, T-12 | OK |
| AC-7 保存データ境界 | D-7 | T-8, T-12 | OK |
| AC-8 Apple サインインとデバイス登録 | D-3, D-5 | T-3, T-5, T-9 | OK |
| AC-9 後続実装順 | D-1, D-8 | T-1, T-10 | OK |
| AC-10 永続 docs 更新案 | D-9 | T-11, T-12 | OK |

> 漏れ・孤立の有無: 全 AC に設計要素・タスクが対応。要求に紐づかない設計・タスクなし。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- [x] Q-1: 最初の配布範囲 → **TestFlight 20〜50人の小規模検証版**。
- [x] Q-2: 小規模検証版のクラウド範囲 → **フルクラウド化**。
- [x] Q-3: クラウド保存範囲 → **MVP中核データ + 集計値 + レコメンド結果まで。詳細ログ・外部資格情報・生データは保存しない**。
- [x] Q-4: iPhone 側の主経路 → **ネイティブ iPhone アプリ主経路。Shortcuts 由来の起動シグナルもアプリ側に吸収**。
- [x] Q-5: iPhone 配布前ゲート → **配布用 entitlement / TestFlight / クラウド送信まで必須**。
- [x] Q-6: 認証方針 → **Apple サインイン + デバイス同期トークン**。
- [x] Q-7: クラウド基盤方針 → **PaaS + マネージド PostgreSQL**。
- [x] Q-8: ローカル版の扱い → **同一コードベースの local mode として残す**。
- [x] Q-9: 最初の作業単位 → **実行モード設計 + 認証境界設計**。
- [x] Q-10: ADR 作成 → **2本作成済み**。

### 設計上の前提（崩れると設計が変わるもの）

- 前提1: 小規模検証版は商品版に近い失敗パターンを集める検証段階であり、一般公開版ではない。
- 前提2: PaaS とマネージド PostgreSQL の具体サービスは後続で決める。
- 前提3: Apple サインインは本命だが、実装時に最新仕様と審査要件を公式情報で再確認する。
- 前提4: DeviceActivity の配布用 entitlement は配布前ゲートで確認する。
- 前提5: local mode は開発者・自分用であり、小規模検証版ユーザーにはローカル Mac サーバーを要求しない。

## 影響範囲

- `docs/` への影響 / 更新案:
  - `docs/glossary.md`: `小規模検証版` / `local mode` / `cloud-testflight mode` / `production mode` 追記済み。
  - `docs/adr/0001-cloud-testflight-is-full-cloud.md`: 作成済み。
  - `docs/adr/0002-keep-local-as-local-mode.md`: 作成済み。
  - `docs/architecture.md`: 実行モード、認証 provider、device token、PaaS + managed Postgres 方針を後続で追記。
  - `docs/functional-design.md`: iPhone 同期 API の認証境界と `user_id` 解決責務を後続で追記。
  - `docs/product-requirements.md`: 小規模検証版の位置づけを後続で必要に応じて補足。
- 既存コード・機能への影響:
  - `POST /api/usage/daily` の認証境界に影響。
  - `USAGE_SYNC_TOKEN` は local mode 用の互換手段へ位置づけ直す。
  - repository 層の `user_id` 絞り込みを確認対象にする。
- マイグレーション・後方互換:
  - 本ステアリングではマイグレーションは実施しない。
  - local mode は既存ローカル DB 互換を優先する。
  - cloud-testflight mode は新規クラウド DB 前提でよい。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| セキュリティ/プライバシー | クラウド化で機微データの管理責任が大きくなる | 保存範囲を MVP 中核データ・集計値・レコメンド結果までに制限。詳細ログ・資格情報・生データを保存しない |
| セキュリティ/プライバシー | `user_id` をクライアントから受けて信じるとテナント越えの原因になる | device token / session から `user_id` を解決する方針を AC-5 / D-5 に固定 |
| アーキテクト | local と cloud の構成差が大きいと再現性が落ちる | 同一コードベース、同一 schema、同一 API 契約を前提にし、差分を provider/env に閉じ込める |
| QA | 多ユーザー化では単一ユーザーテストだけでは不十分 | テナント越え防止テストを T-7 として独立タスク化 |
| PM | いきなり一般公開を狙うと検証観点が広がりすぎる | 小規模検証版を TestFlight 20〜50人に限定 |
| Swift/iOS | DeviceActivity は dev 成立済みでも配布時の entitlement と審査が別リスク | 配布用 entitlement / TestFlight / クラウド送信を必須ゲートに固定 |

### 第二意見（フル区分は必須）

- 手段: `grill-with-docs`（`grilling` + `domain-modeling`）で 1問ずつ意思決定。AWS 構成比較のみ `feature-research` 相当として公式情報ベースで調査。
- 要点:
  - TestFlight 20〜50人なら、ローカル配布ではなくフルクラウド化の方が商品版に近い失敗を検証できる。
  - ただしローカル版を廃止すると開発速度を失うため、同一コードベースの `local mode` として残す。
  - AWS App Runner + RDS 以外の候補も確認したが、今の目的では PaaS + マネージド PostgreSQL が料金・速度・運用負荷のバランスで妥当。
  - iPhone はネイティブアプリ主経路、Shortcuts は補助にする。ただし配布用 entitlement は別ゲートで確認する。
- 反映した内容:
  - `docs/glossary.md` に実行モード用語を追記。
  - ADR 2本を作成。
  - 最初の作業単位を PaaS デプロイではなく、実行モード設計 + 認証境界設計に限定。

## 承認

- [x] 未決事項ゼロを確認
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 上記をもって requirements / design / tasklist をまとめて承認
