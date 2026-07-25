# 通知配信の設定・実機確認

> 初回版の5種類の通知を、検証環境で安全に有効化して確認する手順です。Apple Developer、Renderの管理権限と、通知を確認するiPhoneが必要です。

## 前提

- 対象は`cloud-testflight`検証環境です。`local`環境では外部通知を有効にしません。
- 現在の`NOTIFICATIONS_ENABLED`は初期値の`false`です。配信時間制御と通知作成失敗時の再実行は実装・ローカル検証済みですが、資格情報、migration、Cron、iPhoneビルドの確認が終わるまではステップ6以降を実行しません。
- 契約、金額、端末トークンは実在の情報を証跡へ残しません。確認には合成契約を使います。
- 外部配信はAPNs（＝Appleのプッシュ通知サービス）だけを使い、メール通知は行いません。
- 秘密鍵と暗号鍵はRenderのSecretへ保存し、ファイル、画面共有、ログ、コミットへ含めません。
- `NOTIFICATIONS_ENABLED`は最後の確認まで`false`のままにします。

## 手順

### ステップ1：Appleでプッシュ通知を有効にする

アプリIDと署名へAPNs権限を追加します。

1. Apple Developerの「Certificates, Identifiers & Profiles」を開きます。
2. IdentifiersからSubBuddyのApp IDを開きます。
3. Push Notificationsを有効にして保存します。
4. KeysでAPNs用の鍵を作り、Key IDを控え、秘密鍵を安全な場所へ1回だけダウンロードします。
5. Xcodeで`apps/ios/project.yml`からプロジェクトを再生成します。
6. SubBuddyAppのSigning & CapabilitiesにPush Notificationsが表示されることを確認します。

> ⚠ APNs秘密鍵をリポジトリやチャットへ貼り付けません。sandbox用ビルドとproduction用TestFlightの端末トークンを混ぜません。

> ✅ 確認：Debugでは`aps-environment=development`、Archiveでは`aps-environment=production`として署名できます。

### ステップ2：Renderへ秘密値を設定する

通知コードを有効化する前に、必要な値をSecretとしてそろえます。

1. Renderの検証用Web Serviceを開きます。
2. Environmentへ次のキーを追加します。値は各管理画面や安全な乱数生成で用意し、手順書へ書きません。

| キー                                     | 内容                                                              |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `NOTIFICATIONS_ENABLED`                  | 最初は`false`                                                     |
| `NOTIFICATION_ENCRYPTION_KEYS`           | `1:<32バイトのbase64url鍵>`形式。鍵ローテーション時はカンマ区切り |
| `NOTIFICATION_ACTIVE_KEY_VERSION`        | 現在使う鍵番号                                                    |
| `NOTIFICATION_FINGERPRINT_KEY_BASE64URL` | 検索用HMAC鍵。32バイトbase64url                                   |
| `APNS_KEY_ID`                            | AppleのAPNs Key ID                                                |
| `APNS_TEAM_ID`                           | Apple Developer Team ID                                           |
| `APNS_PRIVATE_KEY`                       | APNs秘密鍵の全文                                                  |
| `APNS_TOPIC`                             | `com.subbuddy.app`                                                |
| `APNS_ENVIRONMENT`                       | 検証ビルドに合わせて`sandbox`または`production`                   |

3. 保存後も`NOTIFICATIONS_ENABLED=false`であることを再確認します。

> ⚠ 暗号鍵は32バイトをbase64urlで表した値です。通常のbase64、短いパスワード、環境間の共用は使いません。

> ✅ 確認：すべてSecretとして保存され、Renderのログへ値が表示されていません。

### ステップ3：DB migrationを反映する

通知設定、暗号化したAPNsトークン、送信待ち、アプリ内お知らせのテーブルを追加します。

```bash
cd /workspaces/SubBuddy/apps/web && npx prisma migrate deploy
```

> ⚠ 対象が検証用DBであることをRenderの環境名と接続先で確認してから実行します。本番DBや開発者の個人データ入りDBでは試しません。

> ✅ 確認：`20260723190000_add_notification_delivery`と`20260725010000_add_notification_creation_retry_and_device_timezone`が適用済みと表示されます。

### ステップ4：Render Cronを作る

PostgreSQLの送信待ちを5分ごとに処理します。

1. Render DashboardでNew、Cron Jobを選びます。
2. 検証用Web Serviceと同じリポジトリ、ブランチ、リージョン、環境変数グループを選びます。
3. Root Directoryを`apps/web`にします。
4. Build Commandを`npm ci && npx prisma generate`にします。
5. Commandを`npm run notifications:process`にします。
6. Scheduleを`*/5 * * * *`にします。
7. 同じ環境で通知Cronが1個だけであることを確認します。

> ⚠ Cronを複製すると同じ送信待ちを競合して取得します。処理は冪等ですが、運用上は1環境1個にします。

> ✅ 確認：通知無効時の実行結果が、秘密値や利用者情報を出さず`disabled`を示します。

### ステップ5：iPhoneビルドと設定画面を確認する

機能フラグを有効にする前に、権限と画面が正しく組み込まれているか確認します。

1. Xcodeで検証環境のSubBuddyを実機へインストールします。
2. 合成契約を1件登録し、更新基準日を入力します。
3. ホームの通知案内が主要操作を隠さないことを確認します。
4. 案内を閉じ、再起動後に再表示されないことを確認します。
5. 設定、通知を開き、機能フラグが無効な間は「準備中」と表示され、OS許可が出ないことを確認します。

> ✅ 確認：初回起動やサインイン直後にOSの通知許可が自動表示されません。

### ステップ6：完成ゲートを確認し、検証環境だけで一時的に有効にする

コード側の自動試験、資格情報、migration、Cron、iPhone署名を確認した後に、実機試験の間だけ利用可能状態へ切り替えます。

1. Renderの検証用Web Serviceと通知Cronで`NOTIFICATIONS_ENABLED=true`にします。
2. 両方を再デプロイします。
3. Web設定で通知希望とお知らせが表示されることを確認します。
4. iPhoneの設定、通知を開き、「このiPhoneで通知を設定」を押します。
5. 用途を確認した後にだけOS許可が表示されることを確認し、許可します。
6. 状態が「このiPhoneで有効」になることを確認します。

> ⚠ migration、Cron、iPhone署名のいずれかが未確認なら有効化しません。Web ServiceとCronの片方だけを有効にしません。設定不足時に500エラーになる場合はフラグを`false`へ戻し、秘密値のキー名だけを確認します。

> ✅ 確認：Webの希望とiPhoneの配信状態が別項目として確認できます。

### ステップ7：5種類を合成データで確認する

本文、重複、画面遷移、取消を確認します。

1. 年額通知を有効にし、7日前10時に相当する合成契約で端末内予約を確認します。
2. 月額通知は初期オフで、本人が有効にした後だけ1日前10時に予約されることを確認します。
3. 同期失敗後24時間の予約を確認し、同期成功後に予約が消えることを確認します。
4. 2台目の検証端末または検証Webブラウザで新規サインインし、発生端末以外のiPhoneと「お知らせ」に1件だけ出ることを確認します。
5. 削除予定の日程計算、通知作成、取消は実装済みです。削除専用コード・無活動削除・TestFlight終了削除を発生させる上流処理が接続された後に、合成アカウントで90・30・7日前、申請直後・24時間前、終了時の各経路を確認します。端末現地の20時以降ではAPNsを送らず次の9時へ繰り下げ、新規サインインは時間外でも即時に処理することも確認します。上流処理がない間は未確認として残し、アプリ内とAPNsを合格扱いにしません。
6. 通知作成処理を一時的に失敗させる検証では、認証セッションが成功したまま通知作成待ちが残り、Cron再実行後にお知らせとAPNs配信対象が各1件になることを確認します。
7. 安全通知は最初にdry-runだけを行います。

```bash
cd /workspaces/SubBuddy/apps/web && npm run notifications:safety -- --incident-id synthetic-notification-check
```

8. 表示された対象件数と経路を確認した後、検証環境だけでapplyします。

```bash
cd /workspaces/SubBuddy/apps/web && npm run notifications:safety -- --incident-id synthetic-notification-check --apply
```

9. 同じ事故IDで再実行して二重作成されないことを確認します。
10. 通知をタップし、更新、同期、端末とセッション、お知らせの対応画面へ移動することを確認します。

> ⚠ 通知本文、Cron出力、監査証跡へ契約名、金額、更新日、利用量、端末トークンを残しません。

> ✅ 確認：5種類の各経路で重複0件、別利用者への配信0件、禁止情報0件です。

### ステップ8：停止と後片付けを確認する

問題時に通知だけを止め、閲覧・退会を維持できることを確認します。

1. RenderのWeb ServiceとCronで`NOTIFICATIONS_ENABLED=false`に戻します。
2. Cronを再実行し、外部送信が始まらないことを確認します。
3. iPhoneでサインアウトし、端末内予約と端末トークンが解除されることを確認します。
4. 合成契約と合成アカウントを既定の削除手順で片付けます。

> ✅ 確認：通知は停止し、契約閲覧、データ出力、完全退会の経路は維持されています。

## 困ったとき

- iPhoneが「OS設定で停止中」：iPhoneの設定、通知、SubBuddyで許可状態を確認します。アプリから許可画面を繰り返し出しません。
- 「配信準備中」のまま：APNsトークンが届く実機ビルドか、端末IDが有効か、WebとCronのAPNs環境が一致するかを確認します。
- 問題を切り分けられない：`NOTIFICATIONS_ENABLED=false`へ戻し、利用者情報を含まない件数・エラー分類だけで調査します。
