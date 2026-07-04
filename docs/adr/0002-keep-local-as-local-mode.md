# ローカル版は別構成にせず local mode として残す

SubBuddy のローカル版は廃止せず、同一コードベースの `local mode` として残す。`local mode`、`cloud-testflight mode`、`production mode` は、Next.js アプリ、Prisma schema、Zod schema、API 契約、ドメインロジック、レコメンドエンジン、iPhone 集計値のワイヤ形式を共有し、差分は DB 接続先、認証プロバイダ、同期トークン発行元、URL/TLS/ホスティング、運用設定に閉じ込める。

**Considered Options**

- ローカル版を廃止する: 本番との差分は減るが、開発速度と既存 MVP 資産を失う。
- ローカル版とクラウド版を完全に別構成にする: 手元では動くがクラウドで壊れる差分が増え、認証・テナント分離・同期 API の再現性が落ちる。
- すべてを本番同等クラウドだけで開発する: 環境の忠実度は高いが、軽い修正やUI検証まで外部サービス依存になり、開発が重くなる。

**Consequences**

認証方式は環境ごとに異なってよいが、Route Handler 以降は認証済みの内部モデルに正規化する。ローカル簡易認証、Apple サインイン、デバイス同期トークンは provider として分離し、API と repository は解決済み `user_id` を前提に処理する。
