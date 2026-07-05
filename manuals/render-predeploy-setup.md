# Render 事前設定手順

> 対象: SubBuddy `cloud-testflight mode` を Render で動かす前に、運用者が Render 側で準備すること。
> この手順では、実シークレット・本番値・個人データは書かない。

## 0. 前提

- Render アカウントを作る運用者が実施する。
- GitHub 上に SubBuddy リポジトリがあり、運用者がそのリポジトリへアクセスできる。
- Render は **Web Service + Render Postgres** を使う。
- `cloud-testflight mode` では無料枠ではなく、有料の Web Service と有料 Postgres を使う。
- Apple サインインの値は、別手順の `manuals/apple-sign-in-setup.md` で用意する。

> ⚠ Render の料金・画面名は変わることがある。作業前に [Render Pricing](https://render.com/pricing) と公式 docs を確認する。

## 1. Render アカウントを作る

○ Render にログインできる状態を作る。

□ 操作

1. ブラウザで [Render Dashboard](https://dashboard.render.com/) を開く。
2. `Get Started` または `Sign Up` を選ぶ。
3. GitHub 連携で登録する。メール登録でもよいが、SubBuddy のデプロイでは GitHub 連携が必要になる。
4. 登録メールが届いたら、メール認証を完了する。
5. Render Dashboard に入れることを確認する。

> ✅ Dashboard が開き、左側メニューや `New` ボタンが見える。

## 2. 2FA を有効にする

○ Render アカウントの乗っ取りリスクを下げる。

□ 操作

1. Render Dashboard のアカウント設定を開く。
2. `Account Settings` または `Account Security` を開く。
3. `Two-factor authentication` を有効にする。
4. 認証アプリで QR コードを読み取る。
5. 復旧コードが表示された場合は、安全な場所に保存する。

> ⚠ 復旧コードをリポジトリ、チャット、メモアプリの共有領域に貼らない。

> ✅ 次回ログイン時に 2FA コードを求められる状態になっている。

## 3. Workspace を確認する

○ SubBuddy 用の作業場所を決める。

□ 操作

1. Render Dashboard で現在の Workspace 名を確認する。
2. 個人検証なら既定の個人 Workspace を使う。
3. 複数人で運用するなら、SubBuddy 用 Workspace を作る。
4. Workspace 名を `subbuddy` など分かりやすい名前にする。

> ⚠ TestFlight 検証の段階では、管理者を増やしすぎない。支出・利用状況という機微データを扱うため、必要最小限にする。

> ✅ Render Dashboard の左上などで、SubBuddy 用 Workspace を選べる。

## 4. 支払い方法を登録する

○ 有料 Web Service と有料 Postgres を作れる状態にする。

□ 操作

1. Workspace の `Billing` または `Settings > Billing` を開く。
2. 支払い方法を登録する。
3. 利用予定の構成を確認する。

| 項目 | 推奨 |
|---|---|
| Web Service | Starter |
| Postgres | Basic-1gb |
| Workspace plan | 最初は Hobby でよい。チーム運用や監査が必要になったら Pro を検討 |

> ⚠ 最小費用だけなら Postgres Basic-256mb でも始められるが、配布検証では Basic-1gb を推奨する。余裕が小さい DB は障害調査が難しくなる。

> ✅ Billing 画面で、支払い方法が登録済みになっている。

## 5. GitHub と連携する

○ Render が SubBuddy リポジトリを取得できるようにする。

□ 操作

1. Render Dashboard で `New` を選ぶ。
2. `Web Service` を選ぶ。
3. Git provider として `GitHub` を選ぶ。
4. GitHub の認可画面で Render を許可する。
5. Repository access は SubBuddy リポジトリだけに絞る。
6. Render Dashboard に戻り、SubBuddy リポジトリが候補に出ることを確認する。

> ⚠ GitHub の全リポジトリを許可しない。必要な SubBuddy リポジトリだけにする。

> ✅ Render のリポジトリ選択画面で SubBuddy リポジトリが見える。

## 6. リージョンを決める

○ Web Service と Postgres を同じリージョンに置く。

□ 操作

1. Render のリージョン一覧を確認する。
2. 主な利用者に近いリージョンを選ぶ。
3. Web Service と Postgres で同じリージョンを使う。
4. 決めたリージョンを記録する。

| 項目 | 値 |
|---|---|
| Render region | `<選んだリージョン>` |
| 理由 | `<日本から近い、または運用上都合がよい等>` |

> ⚠ DB と Web Service のリージョンを分けない。遅延が増え、内部接続も使いにくくなる。

> ✅ Web Service と Postgres の作成時に同じリージョンを選ぶ方針が決まっている。

## 7. Render Postgres を作る

○ SubBuddy 用のクラウド DB を作る。

□ 操作

1. Render Dashboard で `New` を選ぶ。
2. `Postgres` を選ぶ。
3. `Name` に `subbuddy-cloud-testflight-db` などを入れる。
4. `Database` と `User` は Render の自動生成でもよい。自分で指定する場合は控えを安全に管理する。
5. Step 6 で決めたリージョンを選ぶ。
6. PostgreSQL version は既定の新しい安定版を使う。
7. Instance type は `Basic-1gb` を選ぶ。
8. Storage は最小から始める。増やすことはできるが、減らせない。
9. `Create Database` を選ぶ。
10. DB の状態が `Available` になるまで待つ。

> ⚠ Render Postgres の external URL は外部接続用。SubBuddy の Web Service からは internal URL を使う。

> ✅ Postgres の詳細画面で `Internal Database URL` を確認できる。

## 8. DB 接続情報を控える

○ Web Service の `DATABASE_URL` に入れる値を準備する。

□ 操作

1. 作成した Render Postgres を開く。
2. `Connect` を開く。
3. `Internal Database URL` をコピーする。
4. パスワード管理ツールなど、安全な場所に一時保管する。

> ⚠ DB URL は秘密情報。リポジトリ、Issue、チャット、手順書に貼らない。

> ✅ `DATABASE_URL` に入れる internal URL が手元にある。

## 9. Web Service 作成時の入力値を準備する

○ Render Web Service 作成画面で迷わないようにする。

□ 操作

次の値を準備する。

| 項目 | 値 |
|---|---|
| Service type | Web Service |
| Repository | SubBuddy リポジトリ |
| Branch | `<デプロイ対象ブランチ>` |
| Root Directory | `apps/web` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Pre-deploy Command | `npx prisma migrate deploy` |
| Start Command | `npm run start` |
| Instance type | Starter |
| Auto Deploy | 初回は手動推奨。運用が安定したら有効化 |

> ⚠ Pre-deploy Command は有料 Web Service で使う。DB migration を手動にしないために設定する。

> ✅ Web Service 作成画面に入れる値がそろっている。

## 10. Web Service を作る

○ Next.js の実行先を作る。

□ 操作

1. Render Dashboard で `New` を選ぶ。
2. `Web Service` を選ぶ。
3. SubBuddy リポジトリを選ぶ。
4. Step 9 の値を入力する。
5. Instance type は `Starter` を選ぶ。
6. まだ環境変数がそろっていない場合は、初回デプロイをすぐ成功させようとしない。
7. 作成後、Service の `Environment` 画面を開く。

> ⚠ Web Service 作成後に自動デプロイが走る場合がある。環境変数不足で失敗しても、設定を入れて再デプロイすればよい。

> ✅ Render Dashboard に SubBuddy の Web Service が作られている。

## 11. 環境変数を設定する

○ SubBuddy が `cloud-testflight mode` で動くための設定を入れる。

□ 操作

1. Web Service の `Environment` を開く。
2. 次の環境変数を追加する。
3. 保存する。

| Key | Value |
|---|---|
| `SUBBUDDY_MODE` | `cloud-testflight` |
| `NODE_VERSION` | `24.16.0` |
| `DATABASE_URL` | `<Render Postgres の Internal Database URL>` |
| `APPLE_TEAM_ID` | `<Apple Developer Team ID>` |
| `APPLE_CLIENT_ID` | `<Apple Service ID または Bundle ID 方針に沿った Client ID>` |
| `APPLE_KEY_ID` | `<Apple Sign in key ID>` |
| `APPLE_PRIVATE_KEY` | `<Apple private key。改行を含む場合は扱い方を後続実装で確定>` |
| `APPLE_REDIRECT_URI` | `<Render の callback URL>` |
| `APPLE_SUBJECT_HASH_SALT` | `<ランダムに生成した salt>` |

> ⚠ `APPLE_PRIVATE_KEY`、`DATABASE_URL`、`APPLE_SUBJECT_HASH_SALT` は秘密情報。Render Dashboard 以外に貼らない。

> ⚠ `USAGE_SYNC_TOKEN` は local mode 用の互換手段。cloud-testflight の主認証には使わない。

> ✅ Web Service の Environment 画面に必要な key が入っている。

## 12. Apple の callback URL を確定する

○ Apple サインインが Render URL に戻れるようにする。

□ 操作

1. Render Web Service の公開 URL を確認する。
2. callback URL を決める。
3. Apple Developer 側の Sign in with Apple 設定にも同じ URL を登録する。

| 項目 | 値 |
|---|---|
| Render URL | `https://<service-name>.onrender.com` |
| Callback URL | `https://<service-name>.onrender.com/api/auth/apple/callback` |

> ⚠ カスタムドメインを使う場合、Apple 側にもカスタムドメインの callback URL を登録する。Render の一時 URL と混ぜない。

> ✅ Render の `APPLE_REDIRECT_URI` と Apple Developer 側の Return URL が一致している。

## 13. カスタムドメインを使う場合だけ設定する

○ TestFlight で見せる URL を安定させる。

□ 操作

1. Web Service の `Settings` または `Custom Domains` を開く。
2. `Add Custom Domain` を選ぶ。
3. 使うドメインを入力する。
4. Render が表示する DNS レコードを、DNS 管理サービスに追加する。
5. Render Dashboard に戻り、`Verify` を選ぶ。
6. TLS 証明書が発行されるまで待つ。
7. 必要なら `onrender.com` サブドメインを無効化する。

> ⚠ DNS 反映には時間がかかる。失敗しても数分から数十分待って再確認する。

> ✅ ブラウザでカスタムドメインに HTTPS でアクセスできる。

## 14. 通知先を設定する

○ デプロイ失敗や障害に気づけるようにする。

□ 操作

1. Workspace または Web Service の通知設定を開く。
2. メール通知を有効にする。
3. チームで運用する場合は Slack 通知を検討する。
4. 通知先が個人の見落としやすいメールだけになっていないか確認する。

> ✅ デプロイ失敗時に運用者へ通知が届く設定になっている。

## 15. ログの扱いを決める

○ PII・秘密情報をログに残さない方針を確認する。

□ 操作

1. Render の Web Service の `Logs` を開けることを確認する。
2. 運用ルールとして、次をログに出さないことを確認する。

| 出してはいけないもの | 例 |
|---|---|
| DB URL | `postgresql://...` |
| Apple private key | `-----BEGIN PRIVATE KEY-----...` |
| device sync token | iPhone 同期用 bearer token |
| 個人の支出・利用詳細 | 実サブスク名、金額、利用日など |

> ⚠ ログは障害調査に便利だが、機微データが残るとリスクになる。エラーには汎用文だけを出す。

> ✅ 運用者が「ログに何を出してはいけないか」を把握している。

## 16. 事前設定の完了チェック

○ デプロイ作業に進める状態か確認する。

□ 操作

次の項目をチェックする。

- [ ] Render アカウントがある。
- [ ] 2FA が有効。
- [ ] 支払い方法が登録済み。
- [ ] GitHub 連携は SubBuddy リポジトリだけに絞っている。
- [ ] Web Service と Postgres のリージョンを決めた。
- [ ] Render Postgres を作成済み。
- [ ] `DATABASE_URL` は internal URL を使う。
- [ ] Web Service を作成済み。
- [ ] `SUBBUDDY_MODE=cloud-testflight` を設定済み。
- [ ] `NODE_VERSION=24.16.0` を設定済み。
- [ ] Apple サインイン用の環境変数を設定済み。
- [ ] callback URL が Render と Apple Developer で一致している。
- [ ] ログに PII・秘密情報を出さない方針を確認済み。

> ✅ すべてチェックできたら、後続の Render デプロイ検証に進める。

## 17. 参考リンク

- Render Next.js: https://render.com/docs/deploy-nextjs-app
- Render Postgres: https://render.com/docs/postgresql-creating-connecting
- Render 環境変数・Secret Files: https://render.com/docs/configure-environment-variables
- Render GitHub 連携: https://render.com/docs/github
- Render Login Settings / 2FA: https://render.com/docs/login-settings
- Render pre-deploy command: https://render.com/docs/deploys#pre-deploy-command
- Render Node version: https://render.com/docs/node-version
- Render custom domains / TLS: https://render.com/docs/custom-domains
- Render pricing: https://render.com/pricing
