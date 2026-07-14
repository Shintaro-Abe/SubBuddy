# レビューパック - Apple認証・テナント境界

## 区分

- [ ] 軽量（バグ修正・小改修。基本設計に触れない）
- [x] フル（認証、DB、全API、iPhone/Webへ影響。第二意見必須）

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 | Apple subjectの共通内部user解決 | T-5, T-13 | 対応 |
| AC-2 | 15分access・1回限りrefresh | T-1, T-3, T-5 | 対応 |
| AC-3 | rotation・再利用検知・family失効 | T-1, T-4, T-12 | 対応 |
| AC-4 | Web Cookie・Origin・CSRF | T-6 | 対応 |
| AC-5 | 保持オフ・30日未使用・90日最長 | T-2, T-6 | 対応 |
| AC-6 | iPhone Keychain・単一更新・1回再試行 | T-7, T-13 | 対応 |
| AC-7 | 全ユーザーAPIのactor必須化 | T-8, T-12, T-13 | 対応 |
| AC-8 | 別テナントIDの404拒否 | T-8, T-12 | 対応 |
| AC-9 | 利用量バッチ所有権と全件rollback | T-9, T-12 | 対応 |
| AC-10 | セッション10件・一覧・失効・全解除 | T-1, T-10, T-12 | 対応 |
| AC-11 | token hash保存・ログ非漏洩 | T-3, T-12 | 対応 |
| AC-12 | local限定固定user・cloud fail closed | T-2, T-8, T-11, T-12 | 対応 |
| AC-13 | logout・失効・削除後の拒否 | T-4, T-7, T-10, T-12 | 対応 |
| AC-14 | Apple障害時の既存session限定継続 | T-2, T-5, T-12 | 対応 |
| AC-15 | 2人以上の合成データ回帰 | T-12 | 対応 |
| AC-16 | local回帰・Render実機確認 | T-7, T-11, T-13 | 対応 |

漏れ・要求に紐づかない設計・タスクはない。`T-14`は全ACの文書・証跡更新であり、単独の製品機能を追加しない。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- なし。認証方式、Apple限定、保持ログイン初期オフ、期限、セッション上限、`user_local`配布禁止は親レビューパックで承認済み。

### 設計上の前提

- iPhoneとWebはApple subjectのhashをキーに同じ内部ユーザーを使う。
- TestFlightとproductionのDB・鍵・Cookie・tokenは分離する。
- 管理者パスキー、オフラインキャッシュ、削除専用コードは別の子作業で扱う。
- 実データ・PII・機密情報をテストや証跡へ使用しない。

## 影響範囲

- `docs/`更新案: `architecture.md`へtoken/session詳細、`functional-design.md`へAPIと`auth_sessions`、`glossary.md`へaccess/refresh/token familyを追記する。
- 既存コード: 全ユーザーデータRoute Handler、auth service、Prisma、Web API client、iOS API client、Keychain、account/device APIへ影響する。
- migration: `auth_sessions`を追加する。既存ユーザーデータの所有者やApple hashは変更せず、localデータをcloudへ自動移行しない。
- 後方互換: localモードだけ固定ユーザーを維持する。cloud-testflightの未認証主要APIは意図的に401へ変わる。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| プロダクト | セッション切れが入力消失につながる | API clientは1回更新・再試行し、更新不能を明示する。未同期保護本体は後続作業へ接続 |
| アーキテクチャ | Apple tokenを毎APIへ送ると依存と漏洩面が増える | 初回・再認証だけApple検証し、短期accessとrotation refreshへ交換 |
| セキュリティ | refresh token窃取後の再利用、CSRF、別テナントID指定が致命的 | opaque hash、family失効、Origin+CSRF、全queryのuserId複合条件、404応答を必須化 |
| プライバシー | session一覧にIP・詳細UAを出すと識別情報が増える | client種別、任意端末名、日時だけを保存・表示し、完全なIPと詳細UAを保存しない |
| QA | 並行refresh、batch部分保存、mode fallbackは通常の正常系試験で漏れる | 競合試験、2ユーザー混在batch、cloud設定不足、配布成果物の静的検査を追加 |
| 運用 | Apple障害を理由に無期限継続すると失効が効かない | 元の期限内かつ最大72時間の既存sessionだけ。新規・再認証操作は停止 |

### 第二意見（フル区分必須）

- 手段: セキュリティ・プライバシー、QA、運用の別ペルソナによるアドバーサリアル・セルフレビュー
- 要点: 主要な破綻点は、更新tokenの並行利用、cloudからlocalへのfallback、IDOR（＝IDを差し替えた他人データ操作）、利用量batchの部分保存、Cookieだけに依存したCSRF対策、Apple障害時の無期限迂回である。
- 反映した内容: transactionによる一度限りのrotation、token family失効、cloud fail closed、404境界、batch全件rollback、Origin+CSRF token、72時間を上限ではなく既存期限内の補助条件として明記した。

## 内部品質ゲート

- [x] 未決事項ゼロ
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] 影響範囲とmigration境界を確認
- [x] 第二意見の指摘を要求・設計・タスクへ反映

## 承認

- [x] requirements / design / tasklistをまとめて承認（2026-07-14）

最初の実装タスクは`T-1`とする。
