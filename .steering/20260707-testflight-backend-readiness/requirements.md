# 要求内容 — TestFlight 向けサーバー側整備（iOS 接続前）

> 後追い作成（2026-07-07 実施分の記録）。作業は完了済み。本書は実施内容を要求として明文化するもの。
> 親ステアリング：`.steering/20260704-testflight-sprint-roadmap/`（ロードマップ・意思決定ログ）。

## 背景・目的

TestFlight 小規模検証版に向けたクリティカルチェーンの要は「計測→送信の一気通貫が動いたら7日連続計測を即開始」（ゲートB）。iOS 実機ビルドは Mac 必須でこの Linux コンテナでは不可のため、iOS が接続する先の**サーバー側（`apps/web`）を先行して実装レベルまで仕上げ、Render 投入を一発で通せる状態**にする。

`grill-with-docs` で確定済みの決定（ADR 0004〜0006・D1〜D11、`ios-implementation-decisions.md`）のうち、サーバー側で未実装・不整合だった箇所を潰す。

## 変更・追加する機能の説明

- やること:
  - 利用量同期を「後勝ち上書き」から「バケット最大値マージ」へ（ADR 0006）。
  - Apple identity token の `aud` 検証を許可リスト方式へ（Web/iOS 両対応・ADR 0004）。
  - iOS ネイティブ Sign in with Apple 用エンドポイント `POST /api/auth/apple/native` を追加（D2）。
  - デバイス登録を `clientDeviceId`（iOS 端末内生成 UUID）で冪等 upsert 化（D3）。
  - アカウント削除 `DELETE /api/account`（物理削除・カスケード）を追加（D7）。
  - Render 起動確認用 `GET /api/health` を追加。
  - Render 事前設定手順書を実装に合わせて是正（`APPLE_ALLOWED_CLIENT_IDS`・health 手順）。
  - 実 DB での通し検証スクリプトを追加。
  - 本番ビルドのブロッカー（Web フォント外部取得依存）を解消。
- やらないこと:
  - iOS アプリ本体・Extension の実装（Mac 作業）。
  - Render への実デプロイ・Apple Developer 設定（運用者の外部作業）。
  - 実機7日連続計測。
  - フォントの自ホスト化（`next/font/local`）。今回は system fallback で対応し、後続判断とする。

## ユーザーストーリー

- 運用者として、Render の手順書どおりに進めればビルドとマイグレーションが一発で通ってほしい。デプロイでつまずきたくないから。
- iPhone 利用者として、同じ端末で再サインインしてもデバイスが増殖せず、当日の利用量が過小評価されないでほしい。正しい見直し提案を受けたいから。
- 利用者として、アプリからアカウントを完全削除できてほしい。支出という機微データを残したくないから。

## 受け入れ条件

- [x] AC-1: 同一 `(subscription_id, usage_date)` への再送・追加送信で、バケットは最大値へ収束し下がらない（`used` は OR、分推定は null 安全 max）。
- [x] AC-2: Apple identity token の `aud` が `{com.subbuddy.web, com.subbuddy.app}` のいずれかなら受理し、リスト外は拒否する。
- [x] AC-3: iOS 用サインイン検証エンドポイント `POST /api/auth/apple/native` が存在し、Web コールバックと分離されている。
- [x] AC-4: 同一 `(user_id, client_device_id)` のデバイス登録は 1 レコードに収束し、同期トークンは再発行される。
- [x] AC-5: `DELETE /api/account` が本人確認のうえ当該 `user_id` の全関連データを物理削除し、他ユーザーのデータは残る。
- [x] AC-6: `GET /api/health` が DB・secret に触れずに `{ ok, mode }` を返す。
- [x] AC-7: `npx prisma migrate deploy` が新規マイグレーション込みで空 DB にクリーン適用される。
- [x] AC-8: Render 手順書に `APPLE_ALLOWED_CLIENT_IDS` と `/api/health` 確認が反映され、HTML も再生成済み。
- [x] AC-9: `npm run build` / `typecheck` / `lint` / `test` が成功する。
- [x] AC-10: テナント越え（他ユーザーのサブスクへの書き込み）が拒否される。

## 制約事項

- PII・機微データ方針：iPhone から受けるのは集計値のみ。実データ・実メール・秘密情報をリポジトリに入れない。検証は合成データのみ。
- ローカルファースト：`local mode` は廃止せず併存（`USAGE_SYNC_TOKEN` 互換）。
- 秘密情報は平文保存・ログ出力しない（token は hash 保存）。
- `usage_date` は iPhone 現地時刻で確定し、サーバーは変換しない（ADR 0006）。
- Bundle ID / App Group / Services ID は D1 の値に従う。
