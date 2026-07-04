# 永続ドキュメント更新案

> 対象: クラウド認証境界設計を、後続実装前に `docs/` へ反映するための更新案。ここでは差分案を整理し、実際の `docs/` 更新は後続タスクで行う。

## 1. `docs/architecture.md`

更新目的:

- ローカルMVPだけでなく、`local mode` / `cloud-testflight mode` / `production mode` の実行モードを明示する。
- クラウド版の認証境界とデバイス同期トークンを技術仕様として追加する。

追記・更新候補:

- §4 実行環境とデプロイ
  - `local mode`
  - `cloud-testflight mode`
  - `production mode`
  - PaaS + マネージド PostgreSQL 方針
- §8 認証・セキュリティ
  - Apple サインイン
  - device token auth
  - `AuthenticatedActor` 相当の内部認証モデル
  - `USAGE_SYNC_TOKEN` は local mode 用互換手段
- §8.2 機微データ・秘密情報
  - token はハッシュ保存
  - 詳細ログ・外部資格情報・生データは保存しない
- §12 技術リスク
  - Apple サインイン実装・DeviceActivity 配布用 entitlement・TestFlight 審査をリスクに追加

## 2. `docs/functional-design.md`

更新目的:

- iPhone 同期 API の `user_id` 解決責務を、クライアント入力ではなく認証境界へ移す。
- デバイス登録と同期トークンを機能フローとして追加する。

追記・更新候補:

- §4 機能一覧
  - デバイス登録 / 同期トークン管理をクラウド版機能として追加
- §5 データモデル
  - `devices` テーブル案を追加
  - token hash、revokedAt、lastSyncedAt を明記
- §10 API設計
  - `POST /api/usage/daily` は device token auth で `user_id` を解決する
  - request body の `userId` を使わない
  - subscription 所有者不一致時は 404 または 403
- ユースケース
  - Apple サインイン
  - iPhone デバイス登録
  - 同期トークン失効・再発行

## 3. `docs/product-requirements.md`

更新目的:

- ポストMVPの中に、小規模検証版という中間段階を明示する。
- 一般公開の前に TestFlight 20〜50人で検証する方針を残す。

追記・更新候補:

- §3 ターゲットユーザー
  - 小規模検証版のテスターを追加
- §10.0 フェーズの考え方
  - MVP → 小規模検証版 → 一般公開版 の順番を補足
- §14 非機能要件
  - クラウド版での保存データ境界、削除導線、プライバシーポリシーを補足

## 4. `docs/glossary.md`

更新済み:

- `小規模検証版`
- `local mode`
- `cloud-testflight mode`
- `production mode`

追加候補:

- `AuthenticatedActor`
- `デバイス同期トークン`
- `デバイス登録`
- `テナント分離`

## 5. `docs/adr/`

作成済み:

- `0001-cloud-testflight-is-full-cloud.md`
- `0002-keep-local-as-local-mode.md`

後続ADR候補:

- Apple サインインを本命認証にする判断
- ネイティブ iPhone アプリを主経路、Shortcuts を補助にする判断
- PaaS + マネージド PostgreSQL の具体サービス選定

## 6. 更新しないもの

- スコアリングの判定ロジックそのもの。
- P1〜P7 のパターン定義。
- iCloud+ 容量ゲートの判定仕様。
- Apple Music / Apple TV+ / Apple Arcade / Apple One の対象外方針。
