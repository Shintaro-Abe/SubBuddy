# SubBuddy 配布版展開ロードマップ

> 目的: ローカルMVPから、TestFlight 20〜50人の小規模検証版を経て、将来の一般公開版へ進めるための工程順をまとめる。
> 詳細設計は各ステアリングで切る。本書は順番と依存関係を示す。

## 前提

- 最初の配布版は TestFlight 20〜50人の小規模検証版とする。
- 小規模検証版はフルクラウド化する。
- クラウド基盤は PaaS + マネージド PostgreSQL 方針とする。
- 認証は Apple サインインを本命にする。
- iPhone はネイティブアプリを主経路、Shortcuts は補助/フォールバックとする。
- iPhone から送るのは詳細ログではなく集計値のみとする。
- ローカル版は廃止せず、同一コードベースの `local mode` として残す。

## 工程

### 1. 実行モードと認証境界を固める

- `local mode` / `cloud-testflight mode` / `production mode` の差分を定義する。
- Route Handler 以降で使う内部認証モデルを決める。
- local auth / Apple auth / device token auth を provider として分離する。
- `USAGE_SYNC_TOKEN` は local mode 用の互換手段として整理する。
- iPhone 同期 API は、クライアント指定の `user_id` を信じず、同期トークンからユーザーを解決する方針にする。

### 2. マルチテナント境界を設計する

- API / repository が必ず認証済み `user_id` で絞り込むルールを決める。
- テナント越え防止の単体/APIテスト方針を作る。
- 保存するデータと保存しないデータを明確にする。
- 削除導線、ログ出力、エラー通知で PII を残さない方針を決める。

### 3. Web/API/DB をクラウド対応する

- PaaS とマネージド PostgreSQL の具体サービスを選定する。
- クラウド用環境変数と secret 管理を定義する。
- Prisma migration と seed のクラウド運用手順を作る。
- Web/API を `cloud-testflight mode` としてデプロイする。
- Webだけで Apple サインイン、ユーザー別データ分離、基本CRUDを確認する。

### 4. デバイス登録と同期トークンを実装する

- iPhone アプリのログイン後に device を登録する。
- デバイス同期トークンを発行・ハッシュ保存する。
- トークンの失効・再発行フローを作る。
- `POST /api/usage/daily` を device token auth に対応させる。
- 複数ユーザーの合成データでテナント越えがないことを確認する。

### 5. iPhone アプリをクラウド送信へ接続する

- DeviceActivity の集計値をクラウド API に送る。
- App Group 経由の本体読取からクラウド送信までを一気通貫で確認する。
- 端末再起動後、日付ズレ、重複送信、欠損を確認する。
- Shortcuts は補助/フォールバックとして、recency 補助に限定して扱う。

### 6. TestFlight 前の配布ゲートを通す

- Apple Developer Program と配布用 entitlement を確認する。
- TestFlight ビルドを作る。
- `.individual` 認可、FamilyActivityPicker、DeviceActivityMonitor Extension の動作を確認する。
- 7日程度の連続計測で、iPhone → API → DB → レコメンド表示まで確認する。
- プライバシーポリシー、データ削除導線、問い合わせ導線を用意する。

### 7. 小規模検証版を配布する

- TestFlight で 20〜50人に配布する。
- オンボーディング、サブスク登録、iPhone連携、レコメンド表示までの離脱点を確認する。
- 同期失敗、認証失敗、権限拒否、端末差分、サポート問い合わせを記録する。
- 保存データ・ログ・監視に PII が過剰に残っていないか確認する。

### 8. 一般公開版へ進むか判断する

- 小規模検証版の失敗パターンを分類する。
- Apple entitlement / 審査 / DeviceActivity の安定性を再評価する。
- PaaS 構成を継続するか、より本番向けの構成へ移すか判断する。
- `production mode` に必要な監視、バックアップ、削除、サポート、法務/プライバシー対応を追加する。
- 一般 App Store 公開へ進むか、TestFlight 検証を延長するか判断する。

## 依存関係

- 工程3は工程1・2の後に行う。
- 工程5は工程4の後に行う。
- 工程7は工程6の配布ゲートを通過してから行う。
- 一般公開判断は、小規模検証版の実データではなく、集計された失敗パターンと運用課題をもとに行う。

## 参照

- `docs/adr/0001-cloud-testflight-is-full-cloud.md`
- `docs/adr/0002-keep-local-as-local-mode.md`
- `.steering/20260630-cloud-auth-boundary/requirements.md`
- `.steering/20260630-cloud-auth-boundary/design.md`
- `.steering/20260630-cloud-auth-boundary/tasklist.md`
- `.steering/20260630-cloud-auth-boundary/review-pack.md`
