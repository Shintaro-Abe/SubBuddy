# タスクリスト - Apple認証・テナント境界

## タスク

| # | タスク | 対応AC | 状態 | 完了条件 |
|---|---|---|---|---|
| T-1 | `AuthSession`、client種別、期限、ローテーション、失効のPrisma schemaとmigrationを追加 | AC-2, AC-3, AC-10, AC-13 | 完了 | unique・index・cascadeを含むmigrationが空DBと既存合成DBで通る |
| T-2 | 環境別issuer/audience/署名鍵/Cookie/期限の設定schemaとcloud起動時検証を実装 | AC-2, AC-5, AC-12, AC-14 | 完了 | cloud設定不足で起動・要求が失敗しlocal actorへ戻らない |
| T-3 | JWT access tokenとopaque refresh tokenの発行・検証・hash保存を実装 | AC-2, AC-11 | 完了 | 15分期限、必須claim、平文非保存を単体試験で確認 |
| T-4 | transactionによるrefresh rotation、並行更新制御、再利用時family失効を実装 | AC-3, AC-13 | 完了 | 同一tokenの並行更新は1件だけ成功し、再利用後は系列全体が拒否される |
| T-5 | Apple native/callbackを共通user解決とセッション交換へ接続 | AC-1, AC-2, AC-14 | 完了 | iOS/Webのaudience違いでも同じsubjectは同じuserIdになる |
| T-6 | Web Cookie、保持ログイン、Origin・CSRF防御、固定redirectを実装 | AC-4, AC-5 | 完了 | Cookie属性、期限、CSRF拒否、open redirect拒否をテストする |
| T-7 | iOS Keychain保存、単一refresh、401後1回再試行、再認証状態を実装 | AC-6, AC-13, AC-16 | 進行中 | refresh競合・無限再試行・失効後の固定ユーザー化がない |
| T-8 | 全ユーザーデータRoute Handlerを`AuthenticatedActor`必須へ移行 | AC-7, AC-8, AC-12 | 完了 | `getCurrentUserId()`利用がlocal境界以外に残らず、未認証401・他人ID404 |
| T-9 | 利用量同期のバッチ所有権検証と全件rollbackを実装 | AC-9 | 完了 | 別userのsubscriptionId混入時に保存0件となる |
| T-10 | セッション一覧・個別失効・全サインアウトと端末失効連携を実装 | AC-10, AC-13 | 完了 | 自分の対象だけ操作でき、上限10件と既存操作継続を確認 |
| T-11 | local/cloud/productionのモード回帰と配布成果物の`user_local`静的検査を追加 | AC-12, AC-16 | 完了 | local互換を維持し、cloud配布経路に固定actorがない |
| T-12 | 2人以上の合成ユーザーで認証・認可・失効・並行・ログ非漏洩試験を実施 | AC-3, AC-7〜AC-16 | 完了 | 自動試験、typecheck、lint、secret scanが通る |
| T-13 | Render testflight環境へmigrationし、iPhone Appleサインインから契約APIまで実機確認 | AC-1, AC-6, AC-7, AC-16 | 進行中 | 実データを証跡へ持ち出さず、対象環境で一気通貫を確認 |
| T-14 | 機能設計・技術仕様・用語・WBS・親トレーサビリティを更新 | AC-1〜AC-16 | 完了 | docsと実装が一致し、親`REL-0.2`の証跡を記録できる |

状態: 未着手 / 進行中 / 完了 / 保留

## 実装順

`T-1 → T-2 → T-3 → T-4 → T-5 → (T-6, T-7) → T-8 → T-9 → T-10 → T-11 → T-12 → T-13 → T-14`

WebとiPhoneのクライアント作業は共通交換API完成後に分けられるが、管理者1人の標準日程では順番に実施する。

## 実装中の逸脱ログ

- 根幹変更なし。Webの15分access期限切れを利用者操作なしで復旧するため、タブ内PromiseとWeb Locksでrefreshを直列化し、401後の再試行を1回に限定した。

## 検証記録

- 2026-07-14 T-1: 専用の空DBへ全8 migrationを適用し、Prisma schemaとの差分ゼロを確認した。
- 2026-07-14 T-1: 旧7 migrationと合成ユーザー・端末を持つ専用DBへ追加migrationを適用した。更新token hashの一意制約、端末削除時の参照解除、ユーザー削除時のsession連鎖削除を確認した。
- 2026-07-14 T-1: Webのtypecheck、ESLint、120件の単体テストが合格した。実データは使用していない。
- 2026-07-14 T-2: cloud設定不足、不明な実行モード、期限逸脱、環境に合わないCookie名、HTTP Origin、Apple ID不足を起動時設定検証で拒否する。Webのtypecheck、ESLint、127件の単体テストが合格した。
- 2026-07-14 T-3: `jose`で15分access tokenを発行・検証し、256bit opaque refresh tokenのSHA-256 hashだけをsession作成時に保存する。Webのtypecheck、ESLint、132件の単体テストが合格した。
- 2026-07-14 T-4: transaction内の新世代作成と旧世代の条件更新を実装した。専用合成PostgreSQL DBで同一tokenを並行更新し、成功1件・拒否1件・再利用検知後の系列内有効session 0件を確認した。
- 2026-07-14 T-5（実装途中時点）: 共通Apple user解決とsession発行を接続し、iPhone native経路でnonce必須・15分access・rotation対象refreshを返すところまで実装した。この後、Web callbackをT-6のCookie・state・CSRF防御と合わせて完成させた。
- 2026-07-14 T-5/T-6: Web認証開始、state・nonce、Apple callback、固定`/`遷移、HttpOnly Cookie、保持ログイン初期オフ、Origin・CSRF防御を接続した。15分access期限切れはrefreshを直列化して元の要求を1回だけ再試行する。
- 2026-07-14 T-7（進行中）: iPhoneの更新token・session IDを`ThisDeviceOnly` Keychainへ保存し、accessはメモリだけに保持する。単一refresh、401後1回再試行、更新不能時のApple再認証状態を実装した。Linux環境にXcodeがないためコンパイル・実機確認はT-13と合わせて保留する。
- 2026-07-14 T-8/T-9: 全ユーザーデータRoute HandlerとWeb Server Componentを認証済みuserへ移行した。利用量batchは所有権確認と全upsertを同一transactionへ入れ、混在時は全件rollbackする。
- 2026-07-14 T-10/T-11: 10件上限、一覧、個別・現在・全session失効、端末token連動失効を実装した。`user_local`参照がlocal境界外に無いことを静的試験へ追加した。
- 2026-07-14 T-12: 合成2ユーザーを含むWeb自動試験24ファイル158件、typecheck、ESLintが合格した。変更対象のWeb、iOS、docs、steering、WBSをgitleaksで検査し、漏洩検出0件だった。
- 2026-07-14 T-12（外部レビュー反映）: Greptileの重要指摘3件とCodeRabbitの妥当な指摘を修正した。Web自動試験27ファイル168件、typecheck、ESLintが合格した。iOSのコンパイルと実機確認はT-13に残す。
- 2026-07-14 T-13（保留）: Renderの資格情報、実在Appleアカウント、macOS/Xcode実機環境をこの作業環境では扱わないため未実施。migration、Appleサインイン、契約API、refresh、端末失効を対象環境で再確認する必要がある。
- 2026-07-15 T-13（進行中）: Render事前設定とカスタムドメイン接続が完了。iPhoneの開発確認画面へ契約API確認、サインアウト、端末失効を追加し、現行認証用の実機手順を更新した。Xcodeコンパイル、iOS単体テスト、iPhone実機の15分更新と失効確認は未実施。
- 2026-07-15 T-13（進行中）: Mac実機のiOS単体テストで、アプリの製品名`SubBuddy`とXcodeGenが推定したテストホスト名`SubBuddyApp`の不一致を検出した。`TEST_HOST`と`BUNDLE_LOADER`を実際の製品名で明示し、修正後の再実行待ち。
- 2026-07-15 T-13（進行中）: テストホスト修正後のコンパイルで、`APIClient.registerDevice`の`||`右辺に例外を投げるKeychain読み取りを直接置いたことによるSwiftエラーを検出した。読み取りと条件判定を分離して修正し、Macでの再実行待ち。
- 2026-07-15 T-13（進行中）: 再テストで製品名由来のSwiftモジュール`SubBuddy`とテストの`@testable import SubBuddyApp`の不一致を検出した。表示・製品名は`SubBuddy`のまま、`PRODUCT_MODULE_NAME`を`SubBuddyApp`へ固定し、Macでの再実行待ち。
- 2026-07-15 T-13（進行中）: iPhoneのAppleサインインで401を確認した。設定値の一致後も検証段階を判別できなかったため、token、subject、メール、audience実値、nonceを記録せず、検証失敗の理由コードだけをRenderログへ残す診断を追加した。
- 2026-07-15 T-13（進行中）: 401診断追加後、Web自動テスト27ファイル169件、型チェック、ESLintが合格した。Render反映後に`apple_native_auth_rejected`の`reason`を確認し、実環境の原因を確定する。
- 2026-07-15 T-13（進行中）: 再現時に`apple_native_auth_rejected`がなかったため、Apple交換後の端末登録401と特定した。認証情報を記録せず、Bearer検証、session状態、端末紐付けの固定理由コードだけを`device_registration_rejected`として残す診断を追加した。
- 2026-07-15 T-13（進行中）: 端末登録401診断追加後、Web自動テスト27ファイル170件、型チェック、ESLintが合格した。Render反映後に`device_registration_rejected`の`reason`を確認して原因を確定する。
- 2026-07-14 T-14: `architecture.md`、`functional-design.md`、`glossary.md`、WBS `REL-0.2`を実装状態へ更新した。

## 完了チェック

- [ ] 全タスク完了
- [ ] 全受け入れ条件を検証済み
- [x] lint・型チェック・単体・結合・モード回帰試験を実施
- [x] token・Apple subject・メール・実データがログ・差分・証跡にない
- [x] 必要な`docs/`とWBSを更新
