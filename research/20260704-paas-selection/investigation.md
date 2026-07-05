# PaaS 選定 調査・戦略（実装なし）
> 調査日：2026-07-04 / 対象スコープ：SubBuddy cloud-testflight mode の PaaS・DB 選定 / 起用ペルソナ：テックリード、セキュリティ/プライバシー、Next.js、Prisma/PostgreSQL / adversarial-review反証：セルフ反証で実施（サブエージェントは未使用）

## 1. 調査サマリ（結論）

SubBuddy の `cloud-testflight mode` は **Render Web Service + Render Postgres** を採用する。

- App: Render Web Service（Node.js runtime）
- DB: Render Postgres
- Runtime: Next.js App Router / Route Handlers を `npm run build` + `npm run start` で動かす
- DB migration: Render の pre-deploy command で `npx prisma migrate deploy`
- Region: Web Service と Postgres を同一リージョンに置く
- Mode: `SUBBUDDY_MODE=cloud-testflight`

理由は、既存方針「PaaS + マネージド PostgreSQL」に最も近く、Next.js のサーバー実行、Prisma migration、内部 DB 接続、バックアップ/復旧、運用 UI が一体で揃うため。

## 2. 外部仕様・先行事例（出典付き）

### Render

- Render は Next.js を full app の場合 Node.js Web Service としてデプロイする手順を公式に示している。
  - 出典: https://render.com/docs/deploy-nextjs-app
- Render Postgres は managed PostgreSQL として提供され、有料 DB は point-in-time recovery と logical export を持つ。
  - 出典: https://render.com/docs/postgresql-creating-connecting
- Render Postgres は internal URL と external URL を持つ。Render 内の同一リージョンサービスからは internal URL を使える。
  - 出典: https://render.com/docs/postgresql-creating-connecting
- Render の pre-deploy command は DB migration など、デプロイ前に必ず走らせる処理に使える。有料 Web Service で利用可能。
  - 出典: https://render.com/docs/deploys#pre-deploy-command
- Render は GitHub 連携、自動デプロイ、health check、metrics、logs、private networking、Infrastructure as Code を持つ。
  - 出典: https://render.com/docs/deploys
  - 出典: https://render.com/docs/infrastructure-as-code

### Railway

- Railway は Next.js + Postgres のデプロイ手順が整っており、Prisma migration を pre-deploy command で流す案内もある。
  - 出典: https://docs.railway.com/guides/nextjs
- ただし Railway の PostgreSQL は公式 docs 上、Docker Hub の公式 Postgres image をベースにした service として動き、追加リソースでも unmanaged と説明されている。
  - 出典: https://docs.railway.com/databases/postgresql

### Fly.io

- Fly Postgres は unmanaged と明記されている。Fly は fully-managed database service として Fly Managed Postgres も案内しているが、今回の最短 TestFlight 検証では構成・運用判断が増える。
  - 出典: https://fly.io/docs/postgres/
  - 出典: https://fly.io/docs/postgres/getting-started/what-you-should-know/

### Vercel + DB

- Vercel は Next.js 公式ホスティングとして強いが、SSR は Vercel Functions 上で動く。
  - 出典: https://vercel.com/docs/frameworks/full-stack/nextjs
- SubBuddy は `PaaS + マネージド PostgreSQL` を1つの運用面で扱いたい。Vercel + Neon/Supabase 等にすると App と DB の責務分離は明確だが、初回配布では運用面が2ベンダーになる。

### AWS App Runner + RDS

- AWS App Runner は 2026-07-04 時点の公式 docs で「new customers に open ではない」と明記されているため、新規採用しない。
  - 出典: https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html
- RDS for PostgreSQL 自体は本番向けに強いが、小規模検証版の初手としては AWS 運用が重い。
  - 出典: https://aws.amazon.com/rds/postgresql/pricing/

## 3. 既存コードの規約・類似実装

- Next.js App Router 構成は `apps/web/src/app`。
- API は Route Handlers: `apps/web/src/app/api/**/route.ts`。
- package scripts:
  - `build`: `next build`
  - `start`: `next start`
  - `typecheck`: `tsc --noEmit`
  - `test`: `vitest run`
  - `db:seed`: `tsx prisma/seed.ts`
- Prisma schema は `apps/web/prisma/schema.prisma`。
- `.tool-versions` は `nodejs 24.16.0`。
- 既存アーキテクチャは `cloud-testflight mode` を PaaS + マネージド PostgreSQL、Apple サインイン、デバイス同期トークンと定義している。
  - `docs/architecture.md`
  - `.steering/20260630-cloud-auth-boundary/`

## 4. 実装戦略（採用案）

### Render 構成

1. Render Project を作る。
2. Render Postgres を作る。
3. Render Web Service を `apps/web` root directory で作る。
4. Web Service に環境変数を設定する。
5. Web Service と Postgres を同一リージョンに置き、DB 接続は internal URL を使う。
6. build command は `npm ci && npm run build`。
7. pre-deploy command は `npx prisma migrate deploy`。
8. start command は `npm run start`。
9. deploy 後に cloud-testflight 用の合成 seed は原則入れない。必要なら別の seed/fixture 方針をステアリングで決める。

### 必須環境変数

- `SUBBUDDY_MODE=cloud-testflight`
- `DATABASE_URL=<Render Postgres internal URL>`
- `APPLE_TEAM_ID`
- `APPLE_CLIENT_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_REDIRECT_URI`
- `APPLE_SUBJECT_HASH_SALT`
- `USAGE_SYNC_TOKEN` は local mode 互換用。cloud-testflight の主認証には使わない。

### リポジトリ側の後続変更候補

実装はこの調査では行わない。後続ステアリングで次を扱う。

- `render.yaml` を置くか、Render Dashboard 手動設定にするか決める。
- Node 24.16.0 が Render Node runtime で使えるか確認し、必要なら `.node-version` / engines を追加する。
- monorepo の root directory を `apps/web` にする。
- `APPLE_PRIVATE_KEY` の改行を secret store で扱う方針を決める。
- `cloud-testflight mode` では `db:seed` を自動実行しない。
- migration 失敗時の rollback / manual recovery 手順を作る。
- Render logs に PII や token 平文を出さないことをチェックする。

## 5. 却下した代替案とトレードオフ

### Railway

良い点:
- Next.js + Postgres の導線が速い。
- Prisma migration の pre-deploy command も公式案内がある。

却下理由:
- PostgreSQL が公式 docs 上「unmanaged」と説明されており、SubBuddy の「マネージド PostgreSQLで運用負荷を下げる」方針とずれる。

### Fly.io

良い点:
- アプリ配置とネットワークは強い。
- 将来の地域分散には向く。

却下理由:
- Fly Postgres は unmanaged と明記されている。Managed Postgres もあるが、初回 TestFlight では構成判断が増える。

### Vercel + Neon/Supabase

良い点:
- Next.js との相性は最強。
- Preview deployment 体験が良い。

却下理由:
- App と DB が別ベンダーになり、初回配布の運用説明・障害切り分けが増える。
- SubBuddy は小規模検証版で商品価値と同期/認証/テナント境界を確認する段階なので、最初は一体運用を優先する。

### AWS App Runner + RDS

良い点:
- RDS は本番 DB として強い。
- 将来の本番運用・監査には向く。

却下理由:
- App Runner は新規顧客向けに閉じているため、今から選ぶ対象にしない。
- ECS/Fargate + RDS へ寄せると、小規模検証版の速度に対して運用が重い。

## 6. 反証で出た論点と対応

- 反証: Render も本番大規模運用では AWS/GCP ほど細かい統制がない。
  - 対応: 今回は TestFlight 20〜50人の小規模検証版。まず認証・同期・テナント分離の失敗パターンを集める段階なので、細かいクラウド統制より初速と運用負荷低減を優先する。
- 反証: Vercel は Next.js の本家で、App Router の追随が最も速い。
  - 対応: その利点は認める。ただし SubBuddy は Prisma/Postgres と migration、iPhone 同期 API のサーバー実行が中核。DB まで同じ運用面で持てる Render を初手にする。
- 反証: Railway の方がデプロイは速い可能性がある。
  - 対応: DB が unmanaged と説明されている点を重く見る。PII を含む支出/利用データを預かるため、DB の運用責任が曖昧な構成は避ける。
- 反証: Render の無料枠や安価プランは眠る/制限がある。
  - 対応: TestFlight 配布では無料枠を使わない。最低限の paid Web Service + paid Postgres を前提にする。

## 7. リスク・未確定事項・検証方針

- Render の Node runtime で Node 24.16.0 をそのまま使えるか確認する。
- `next start` の bind port は Render の `PORT` 環境変数に従うか、必要なら start command を調整する。
- `APPLE_PRIVATE_KEY` の secret store 登録方法を確認する。
- Postgres backup/PITR の対象プランを確定する。
- Region は日本からの iPhone 同期を考えると Singapore/Tokyo 近傍が望ましいが、Render の提供リージョンと DB リージョンを確認して選ぶ。
- cloud-testflight 用の初期管理データと service catalog seed をどう扱うか決める。合成 seed をそのまま配布環境へ入れない。
- 後続で `.steering/20260704-render-cloud-testflight-deploy/` を切り、requirements/design/tasklist/review-pack を作る。

## 8. 参考リンク（出典一覧）

- Render: Deploy a Next.js App: https://render.com/docs/deploy-nextjs-app
- Render: Create and Connect to Render Postgres: https://render.com/docs/postgresql-creating-connecting
- Render: Deploys / pre-deploy command: https://render.com/docs/deploys#pre-deploy-command
- Render: Infrastructure as Code: https://render.com/docs/infrastructure-as-code
- Railway: Deploy a Next.js App with Postgres: https://docs.railway.com/guides/nextjs
- Railway: PostgreSQL: https://docs.railway.com/databases/postgresql
- Fly.io: Fly Postgres: https://fly.io/docs/postgres/
- Fly.io: This Is Not Managed Postgres: https://fly.io/docs/postgres/getting-started/what-you-should-know/
- Vercel: Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
- AWS App Runner: What is AWS App Runner?: https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html
- AWS RDS for PostgreSQL pricing: https://aws.amazon.com/rds/postgresql/pricing/
