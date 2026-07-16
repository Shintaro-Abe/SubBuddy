# 認証境界・実行モード仕様

> 対象: `.steering/20260630-cloud-auth-boundary/` の詳細仕様。コード実装前に、実行モード・認証 provider・テナント分離の境界を固定する。
>
> 現行性注記（2026-07-15）：本書はクラウド認証境界の初期設計履歴である。短期アクセストークン、ローテーション更新トークン、Cookie/CSRF、セッション失効、`user_local`隔離を含む現行仕様は`.steering/20260713-auth-tenant-boundary/`と`docs/architecture.md`を正とする。

## 1. 実行モード

| mode | 用途 | DB | Web認証 | iPhone同期認証 | 対象ユーザー |
|---|---|---|---|---|---|
| `local` | 開発者・自分用のローカル実行 | ローカル PostgreSQL | ローカル簡易認証 | `USAGE_SYNC_TOKEN` | 開発者 |
| `cloud-testflight` | TestFlight 20〜50人の小規模検証版 | マネージド PostgreSQL | Apple サインイン | デバイス同期トークン | テスター |
| `production` | 将来の一般公開版 | マネージド PostgreSQL | Apple サインイン | デバイス同期トークン | 一般ユーザー |

共通にするもの:

- Next.js アプリ
- Prisma schema
- Zod schema
- Route Handler の API 契約
- repository / domain / scoring logic
- iPhone から送る日別集計値のワイヤ形式

mode 差分として閉じ込めるもの:

- DB 接続先
- 認証 provider
- 同期トークンの発行元
- public URL / TLS / hosting
- 監視・ログ・バックアップ・削除導線

## 2. 内部認証モデル

Route Handler 以降は、認証方式を直接扱わず、次のような内部モデルに正規化する。

```ts
type AuthenticatedActor =
  | {
      kind: "user";
      userId: string;
      authProvider: "local" | "apple";
    }
  | {
      kind: "device";
      userId: string;
      deviceId: string;
      authProvider: "device_token";
    };
```

原則:

- `userId` はクライアント入力ではなく、認証 provider が解決する。
- Web API は `kind: "user"` を使う。
- iPhone 同期 API は `kind: "device"` を使う。
- domain / repository は `AuthenticatedActor` または解決済み `userId` を受け取り、認証方式を知らない。

## 3. 認証 provider

### 3.1 local auth

用途:

- `local mode` の開発・自分用。
- 既存ローカルMVPを壊さず維持する。

入力:

- Web: localhost 前提の簡易セッション、または開発用固定ユーザー。
- iPhone同期: `Authorization: Bearer <USAGE_SYNC_TOKEN>`。

出力:

- Web: `{ kind: "user", userId: "user_local", authProvider: "local" }`
- iPhone同期: `{ kind: "device", userId: "user_local", deviceId: "local_device", authProvider: "device_token" }` 相当に正規化してもよい。

制約:

- `USAGE_SYNC_TOKEN` は `local mode` 用の互換手段。
- `cloud-testflight mode` では単一共有トークンを使わない。

### 3.2 Apple auth

用途:

- `cloud-testflight mode` / `production mode` の Web・iPhone ログイン。

入力:

- Apple サインインの認証結果。

出力:

- `{ kind: "user", userId, authProvider: "apple" }`

設計メモ:

- Apple 側の stable identifier と SubBuddy の `users.id` を紐づける。
- メールアドレスは必須識別子にしない。Apple の非公開メールや変更に耐える。
- Apple サインインの最新仕様・審査要件は実装前に公式情報で再確認する。

### 3.3 device token auth

用途:

- iPhone アプリから `POST /api/usage/daily` へ集計値を送る。

入力:

- `Authorization: Bearer <device_sync_token>`

出力:

- `{ kind: "device", userId, deviceId, authProvider: "device_token" }`

設計メモ:

- トークンは平文保存しない。ハッシュ保存する。
- トークンは失効・再発行できる。
- 最終同期日時を記録する。
- 退会・デバイス削除・不正利用疑い時に失効できる。

## 4. iPhone 同期 API のユーザー解決

禁止:

- request body の `userId` を信じる。
- `subscriptionId` だけで upsert する。
- 複数ユーザーに同じ共有トークンを配る。

採用:

1. Authorization header から device sync token を受け取る。
2. token hash で `devices` を検索する。
3. device が有効なら `userId` と `deviceId` を解決する。
4. payload を Zod で検証する。
5. `subscriptionId` が解決済み `userId` の所有物か確認する。
6. `ios_usage_daily_summaries` を `(subscription_id, usage_date)` で upsert する。
7. 保存する `user_id` は token から解決した `userId` にする。

## 5. データモデル案

この作業では migration は作らない。後続実装で検討する最小案は次。

```prisma
model Device {
  id            String   @id @default(cuid())
  userId        String
  name          String?
  tokenHash     String   @unique
  revokedAt     DateTime?
  lastSyncedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("devices")
}
```

検討事項:

- device name はユーザー表示用。PII になり得るため任意・短文に限定する。
- token hash は漏えい時の被害を抑えるため必須。
- `revokedAt` で失効状態を表す。

## 6. テナント分離ルール

必須ルール:

- Web API は session / Apple auth から `userId` を解決する。
- iPhone API は device token から `userId` を解決する。
- repository 関数は `userId` を必須引数にする。
- subscription / billing / usage / recommendation は必ず `user_id` で絞る。
- `subscriptionId` を受ける処理は、その subscription が `userId` 所有か確認する。

禁止パターン:

- `findUnique({ where: { id } })` だけでユーザー所有データを読む。
- route 内で `LOCAL_USER_ID` を直接使う。
- request body の `userId` を DB 書き込みに使う。
- ログに token / Apple identifier / メールアドレス / 詳細利用データを出す。

## 7. テスト方針

合成データで、最低2ユーザーを作る。

確認すること:

- user A の session で user B の subscription を読めない。
- user A の device token で user B の subscription に usage を upsert できない。
- revoked device token は 401 になる。
- token なし・誤 token は 401 になる。
- subscription 所有者不一致は 404 または 403 にする。情報漏えいを避けるなら 404 を優先する。
- local mode では既存 `user_local` のフローが壊れない。

## 8. 保存データ境界

保存する:

- ユーザーアカウント
- サブスク名、金額、課金周期、更新日、カテゴリ、重要度、解約URL
- iPhone からの利用集計値
- レコメンド結果
- サービスカタログとの紐付け
- デバイス登録情報と token hash

保存しない:

- 外部サービスの ID / パスワード
- Apple ID の資格情報
- Screen Time の詳細ログ
- 全アプリ一覧
- 領収書メール本文そのもの
- クレカ明細や銀行明細の生データ
- 位置情報の生ログ

## 9. 後続順序

1. 本仕様をもとに `docs/architecture.md` と `docs/functional-design.md` の更新案を作る。
2. `AuthenticatedActor` / auth provider の型と境界を実装する。
3. repository の `userId` 必須化とテナント分離テストを入れる。
4. Apple サインインを接続する。
5. device 登録と token 発行・失効を実装する。
6. `POST /api/usage/daily` を device token auth に対応させる。
7. PaaS + managed PostgreSQL へ `cloud-testflight mode` をデプロイする。
8. iPhone アプリをクラウド API に接続する。
9. TestFlight 配布ゲートを通す。
