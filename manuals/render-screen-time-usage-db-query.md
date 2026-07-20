# Render Web ServiceからScreen Time集計値を確認する手順

> 対象: iPhoneのScreen Timeで取得した日別集計値が、SubBuddyのRender PostgreSQLへ同期されたか確認する運用者。
> 目的: Render Web ServiceのShellからDBへ接続し、データを変更せずに同期状況を確認する。

## 0. この手順で確認すること

○ 次の2点を読み取り専用SQLで確認する。

- `devices.last_synced_at`: iPhoneから同期APIへ最後に到達した日時
- `ios_usage_daily_summaries`: 契約ごと・日ごとに保存されたScreen Time集計値

### 操作場所の見分け方

| 表示 | 操作する場所 | 用途 |
|---|---|---|
| Render Dashboard | MacのWebブラウザ | SubBuddyのWeb Serviceを選ぶ |
| Web ServiceのShell | Render Dashboard内の黒いコマンド入力画面。通常は行頭に`$`などが表示される | `psql`を起動する |
| PostgreSQLの入力画面 | `psql`接続後の同じShell。行頭が`データベース名=>`に変わる | `SELECT`と`\q`を実行する |
| iPhone版SubBuddy | iPhone | Screen Time集計値を同期する |

> ⚠ この手順では`SELECT`だけを使う。`UPDATE`、`DELETE`、`INSERT`、`TRUNCATE`、`DROP`は実行しない。

> ⚠ `DATABASE_URL`、DBパスワード、利用者ID、端末ID、契約名、SQLの実行結果を、チャット、Issue、手順書、スクリーンショット、Gitへ保存しない。

## 1. 前提を確認する

○ RenderのWeb ServiceからDBへ接続できる条件を確認する。

□ 操作

**操作場所: MacのWebブラウザとiPhone**

1. [Render Dashboard](https://dashboard.render.com/)へログインする。
2. SubBuddyのWeb Serviceが有料インスタンスで稼働中であることを確認する。
3. Web Serviceの環境変数に`DATABASE_URL`というキーがあることを確認する。値は表示・コピーしない。
4. iPhoneでSubBuddyへサインイン済みであることを確認する。
5. 対象契約に計測対象アプリが対応付けられていることを確認する。

> ⚠ Renderの無料Web ServiceではDashboard Shellを利用できない。SubBuddyの配布検証構成では有料Web Serviceを使用する。

> ✅ Render DashboardでSubBuddyのWeb Serviceを開け、iPhone版SubBuddyにもサインインできる。

## 2. Web ServiceのShellを開く

○ 稼働中のSubBuddy Web Serviceでコマンドを実行できる状態にする。

□ 操作

**操作場所: MacのWebブラウザに開いたRender Dashboard**

1. Render DashboardでSubBuddyの`Web Service`を選ぶ。
2. PostgreSQLサービスではなく、Next.jsを実行しているWeb Serviceであることを確認する。
3. 左側メニューの`Shell`を選ぶ。
4. 複数インスタンスがある場合は、`Instance`から1台を選ぶ。
5. 黒いコマンド入力画面が表示されるまで待つ。

> ⚠ Shellは稼働中サービスの環境へ接続する。アプリの停止、ファイル削除、DB変更コマンドは実行しない。

> ✅ Web ServiceのShellに入力でき、行頭に`$`などの入力待ち記号が表示される。

## 3. DB接続設定を安全に確認する

○ DB接続URLの値を表示せず、Web Serviceに設定済みか確認する。

□ 操作

**コマンドの実行場所: Render Web ServiceのShell（行頭が`$`などの状態）**

```bash
test -n "$DATABASE_URL" && echo "DATABASE_URL is set"
```

> ⚠ `echo "$DATABASE_URL"`、`env`、`printenv`は実行しない。接続URLや他の秘密情報が画面に表示される。

> ✅ `DATABASE_URL is set`とだけ表示される。

## 4. PostgreSQLへ接続する

○ Web Serviceと同じ内部接続設定でDBへ接続する。

□ 操作

**最初のコマンドの実行場所: Render Web ServiceのShell**

```bash
psql "$DATABASE_URL"
```

接続すると、同じ画面の行頭が`データベース名=>`に変わる。以降のSQLは、この表示がある場所へ入力する。

**次のSQLの実行場所: PostgreSQLの入力画面（行頭が`データベース名=>`の状態）**

```console
SELECT current_database(), current_user, CURRENT_TIMESTAMP;
```

> ⚠ 本番相当DBと検証DBがある場合は、目的の環境か画面上で確認する。結果は保存・共有しない。

> ✅ DB名、接続ユーザー、現在日時が1行表示される。

## 5. 同期前の最終到達日時を確認する

○ iPhoneから同期した前後を比較する基準を作る。

□ 操作

**SQLの実行場所: Step 4で接続したPostgreSQLの入力画面**

```console
SELECT
  COUNT(*) AS active_devices,
  MAX(last_synced_at) AS latest_device_sync
FROM devices
WHERE revoked_at IS NULL;
```

1. `latest_device_sync`の時刻を画面上で確認する。
2. 値をファイルや共有メモへ転記しない。
3. RenderのShell画面は開いたままにする。

> `last_synced_at`はDBのタイムゾーンで表示される。日本時間と異なる場合があるため、時刻の増減で比較する。

> ✅ 同期前の`latest_device_sync`を確認できる。まだ一度も同期していない場合は空でもよい。

## 6. iPhoneから同期する

○ iPhone内の未送信集計値をRenderへ送る。

□ 操作

**操作場所: iPhone版SubBuddy**

1. iPhoneで計測対象アプリを利用し、現在の最小計測しきい値である15分以上に到達させる。
2. SubBuddyを開く。
3. `ホーム`を開く。
4. 右上の`設定`を開く。
5. `同期`を開く。
6. `自動同期`が`オン`で、`最終同期確認`がSubBuddyを開いた後の日時へ更新されたことを確認する。
7. 日時が更新されない場合だけ、通信・サインイン状態を確認し、確認・復旧用の`今すぐ同期`を押す。

> ⚠ 未送信記録が0件の場合、APIへ送る集計値がないため、DBの同期時刻が変わらないことがある。

> ✅ 通常は手動操作なしで、SubBuddyの最終同期確認が更新される。

## 7. 同期APIへの到達を確認する

○ Render側の最終同期日時が新しくなったか確認する。

□ 操作

**SQLの実行場所: Step 4から開いたままのRender Web Service内のPostgreSQL入力画面**

iPhoneからRender Dashboardへ戻り、行頭が`データベース名=>`になっている同じ画面で再実行する。

```console
SELECT
  COUNT(*) AS active_devices,
  MAX(last_synced_at) AS latest_device_sync
FROM devices
WHERE revoked_at IS NULL;
```

> ✅ Step 5より`latest_device_sync`が新しくなっていれば、認証済みiPhoneから同期APIへ到達している。

## 8. アカウント・契約別の日別集計値を確認する

○ 実際の識別子を表示せず、直近7日分の集計値がアカウント・契約別に保存されているか確認する。

□ 操作

**SQLの実行場所: Step 4から開いたままのRender Web Service内のPostgreSQL入力画面**

```console
WITH recent AS (
  SELECT
    DENSE_RANK() OVER (ORDER BY user_id) AS account_no,
    DENSE_RANK() OVER (
      PARTITION BY user_id
      ORDER BY subscription_id
    ) AS contract_no,
    usage_date,
    used,
    usage_bucket,
    estimated_minutes_min,
    estimated_minutes_max,
    source
  FROM ios_usage_daily_summaries
  WHERE usage_date >= CURRENT_DATE - 6
)
SELECT *
FROM recent
ORDER BY account_no, contract_no, usage_date DESC;
```

| 列 | 意味 | 主な期待値 |
|---|---|---|
| `account_no` | この検索結果内だけで使う匿名のアカウント番号 | 同じ番号なら同じアカウント |
| `contract_no` | アカウント内だけで使う匿名の契約番号 | `account_no`とこの番号が両方同じなら同じ契約 |
| `usage_date` | iPhone側で確定した計測日 | 確認対象の日付 |
| `used` | 利用したか | しきい値到達後は`true` |
| `usage_bucket` | 到達した利用時間帯のDB内部表現 | `m15_plus`、`m30_plus`、`m60_plus`など |
| `estimated_minutes_min` | 推定利用時間の下限 | 到達したしきい値以上 |
| `estimated_minutes_max` | 推定利用時間の上限 | 上限不明なら空の場合がある |
| `source` | 集計値の取得元 | `ios_device_activity` |

> `account_no`と`contract_no`はSQL実行時に付ける表示用番号で、DBには保存されない。検索期間やデータが変わると番号も変わるため、今回の結果内でだけ比較する。

> ⚠ 同じ契約・同じ日付は上書き更新される。件数や`created_at`が変わらなくても、より長い`usage_bucket`へ更新されていれば正常。

> ✅ 対象日付の行があり、同じ`account_no`と`contract_no`の行を同一契約の日別集計として確認できる。

## 9. 結果を判定する

○ 同期のどこまで成功したかを切り分ける。

| `latest_device_sync` | 対象日の行 | 判定 |
|---|---|---|
| 新しくなった | ある | API到達と日別集計保存の両方が成功 |
| 新しくなった | ない | 別日付、対象契約、送信内容を確認する |
| 変わらない | ある | 今回は送信対象0件だった可能性がある |
| 変わらない | ない | 未送信記録、サインイン、通信、計測しきい値を確認する |

> ✅ 「APIへ到達したか」と「日別集計が保存されたか」を分けて判定できる。

同じアカウント・契約かは次のように判定する。

| `account_no` | `contract_no` | 判定 |
|---|---|---|
| 同じ | 同じ | 同じアカウントの同じ契約 |
| 同じ | 異なる | 同じアカウントの別契約 |
| 異なる | 同じまたは異なる | 別アカウント |

## 10. DB接続とShellを終了する

○ 誤操作を防ぐため、確認後すぐに接続を閉じる。

□ 操作

**コマンドの実行場所: PostgreSQLの入力画面（行頭が`データベース名=>`の状態）**

```console
\q
```

1. 行頭がShellの`$`などへ戻ったことを確認する。
2. Render DashboardのShellページを閉じるか、別ページへ移動する。
3. SQL結果をコピーしたファイルやスクリーンショットを作っていないことを確認する。

> ✅ PostgreSQL接続を終了し、Shellで追加操作をしていない。

## 11. 接続できない場合

### `Shell`メニューが表示されない

**確認場所: Render DashboardのWeb Service画面**

1. PostgreSQLではなくWeb Serviceを開いているか確認する。
2. Web Serviceが無料インスタンスではないか確認する。
3. 保護された環境の場合、自分がWorkspaceのAdminか確認する。

### `DATABASE_URL is set`が表示されない

**確認場所: Render DashboardのWeb Service `Environment`画面**

1. `DATABASE_URL`キーが存在するか確認する。
2. SubBuddyのWeb ServiceとPostgreSQLが同じ環境・リージョンか確認する。
3. 値をターミナルやチャットへ貼らず、既存のRender Postgres参照設定を確認する。

### `psql: command not found`になる

**コマンドの実行場所: Render Web ServiceのShell**

```bash
which psql
```

SubBuddyのNode.jsネイティブ実行環境にはPostgreSQLクライアントが含まれる。見つからない場合は、別のWeb ServiceやDocker実行環境を開いていないか確認する。稼働中Shellへパッケージを追加インストールしない。

### 同期時刻が変わらない

**操作場所: iPhone版SubBuddy**

1. iPhoneがSubBuddyへサインイン済みか確認する。
2. `設定` → `同期`で未送信記録が1件以上あるか確認する。
3. 計測対象アプリが契約へ対応付けられているか確認する。
4. 対象アプリを15分以上利用する。
5. SubBuddyを前面へ戻し、再度`今すぐ同期`を実行する。

> ⚠ DB接続情報やSQL結果を貼り付けて質問しない。必要な場合は「Shellなし」「DB設定なし」「接続失敗」「時刻未更新」「対象日なし」のいずれかと、秘密情報を除いたエラー種別だけを共有する。

## 完了チェック

- [ ] Render Dashboardで正しいWeb Serviceを開いた。
- [ ] Web ServiceのShellから`psql`を起動した。
- [ ] 同期前の`latest_device_sync`を確認した。
- [ ] iPhoneで未送信集計を同期した。
- [ ] `latest_device_sync`が更新された。
- [ ] `ios_usage_daily_summaries`に対象日の集計値がある。
- [ ] `account_no`と`contract_no`で同一アカウント・同一契約を確認した。
- [ ] DBを変更するSQLを実行していない。
- [ ] 接続情報、識別子、SQL結果を保存・共有していない。
- [ ] `\q`でDB接続を終了し、Shell画面を閉じた。

## 公式情報

- [RenderのShellとSSH](https://render.com/docs/ssh)
- [Renderネイティブ実行環境の利用可能ツール](https://render.com/docs/native-runtimes)
- [Renderの環境変数とシークレット](https://render.com/docs/configure-environment-variables)
