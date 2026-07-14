# タスクリスト - Apple認証・テナント境界

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | `AuthSession`、client種別、期限、ローテーション、失効のPrisma schemaとmigrationを追加 | AC-2, AC-3, AC-10, AC-13 | 完了 | unique・index・cascadeを含むmigrationが空DBと既存合成DBで通る |
| T-2 | 環境別issuer/audience/署名鍵/Cookie/期限の設定schemaとcloud起動時検証を実装 | AC-2, AC-5, AC-12, AC-14 | 完了 | cloud設定不足で起動・要求が失敗しlocal actorへ戻らない |
| T-3 | JWT access tokenとopaque refresh tokenの発行・検証・hash保存を実装 | AC-2, AC-11 | 完了 | 15分期限、必須claim、平文非保存を単体試験で確認 |
| T-4 | transactionによるrefresh rotation、並行更新制御、再利用時family失効を実装 | AC-3, AC-13 | 完了 | 同一tokenの並行更新は1件だけ成功し、再利用後は系列全体が拒否される |
| T-5 | Apple native/callbackを共通user解決とセッション交換へ接続 | AC-1, AC-2, AC-14 | 未着手 | iOS/Webのaudience違いでも同じsubjectは同じuserIdになる |
| T-6 | Web Cookie、保持ログイン、Origin・CSRF防御、固定redirectを実装 | AC-4, AC-5 | 未着手 | Cookie属性、期限、CSRF拒否、open redirect拒否をテストする |
| T-7 | iOS Keychain保存、単一refresh、401後1回再試行、再認証状態を実装 | AC-6, AC-13, AC-16 | 未着手 | refresh競合・無限再試行・失効後の固定ユーザー化がない |
| T-8 | 全ユーザーデータRoute Handlerを`AuthenticatedActor`必須へ移行 | AC-7, AC-8, AC-12 | 未着手 | `getCurrentUserId()`利用がlocal境界以外に残らず、未認証401・他人ID404 |
| T-9 | 利用量同期のバッチ所有権検証と全件rollbackを実装 | AC-9 | 未着手 | 別userのsubscriptionId混入時に保存0件となる |
| T-10 | セッション一覧・個別失効・全サインアウトと端末失効連携を実装 | AC-10, AC-13 | 未着手 | 自分の対象だけ操作でき、上限10件と既存操作継続を確認 |
| T-11 | local/cloud/productionのモード回帰と配布成果物の`user_local`静的検査を追加 | AC-12, AC-16 | 未着手 | local互換を維持し、cloud配布経路に固定actorがない |
| T-12 | 2人以上の合成ユーザーで認証・認可・失効・並行・ログ非漏洩試験を実施 | AC-3, AC-7〜AC-16 | 未着手 | 自動試験、typecheck、lint、secret scanが通る |
| T-13 | Render testflight環境へmigrationし、iPhone Appleサインインから契約APIまで実機確認 | AC-1, AC-6, AC-7, AC-16 | 未着手 | 実データを証跡へ持ち出さず、対象環境で一気通貫を確認 |
| T-14 | 機能設計・技術仕様・用語・WBS・親トレーサビリティを更新 | AC-1〜AC-16 | 未着手 | docsと実装が一致し、親`REL-0.2`の証跡を記録できる |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装順

`T-1 → T-2 → T-3 → T-4 → T-5 → (T-6, T-7) → T-8 → T-9 → T-10 → T-11 → T-12 → T-13 → T-14`

WebとiPhoneのクライアント作業は共通交換API完成後に分けられるが、管理者1人の標準日程では順番に実施する。

## 実装中の逸脱ログ

- なし。Apple以外のログイン追加、token保持方式の変更、cloudでの固定ユーザー許可、別ユーザーIDの自動補完は設計の根幹変更として再承認する。

## 検証記録

- 2026-07-14 T-1: 専用の空DBへ全8 migrationを適用し、Prisma schemaとの差分ゼロを確認した。
- 2026-07-14 T-1: 旧7 migrationと合成ユーザー・端末を持つ専用DBへ追加migrationを適用した。更新token hashの一意制約、端末削除時の参照解除、ユーザー削除時のsession連鎖削除を確認した。
- 2026-07-14 T-1: Webのtypecheck、ESLint、120件の単体テストが合格した。実データは使用していない。
- 2026-07-14 T-2: cloud設定不足、不明な実行モード、期限逸脱、環境に合わないCookie名、HTTP Origin、Apple ID不足を起動時設定検証で拒否する。Webのtypecheck、ESLint、127件の単体テストが合格した。
- 2026-07-14 T-3: `jose`で15分access tokenを発行・検証し、256bit opaque refresh tokenのSHA-256 hashだけをsession作成時に保存する。Webのtypecheck、ESLint、132件の単体テストが合格した。
- 2026-07-14 T-4: transaction内の新世代作成と旧世代の条件更新を実装した。専用合成PostgreSQL DBで同一tokenを並行更新し、成功1件・拒否1件・再利用検知後の系列内有効session 0件を確認した。

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を検証済み
- [ ] lint・型チェック・単体・結合・モード回帰試験を実施
- [ ] token・Apple subject・メール・実データがログ・差分・証跡にない
- [ ] 必要な`docs/`とWBSを更新
