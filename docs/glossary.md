# ユビキタス言語定義（Glossary）

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：永続的ドキュメント（`docs/`）
> 最終更新：2026-06-30
> 関連：`product-requirements.md`、`functional-design.md`、`architecture.md`、`repository-structure.md`、`development-guidelines.md`

---

## 1. 本書の位置づけ

本書は SubBuddy で用いる **ドメイン用語・ビジネス用語・UI/UX 用語** の定義と、
**英語・日本語・コード上の命名** の対応を一元化する。ドキュメント・コード・UI で同じ概念に同じ語を使うこと（ユビキタス言語）を目的とする。

- 用語の定義に迷ったら本書を一次情報とする。新しいドメイン語が生まれたら本書を更新する。
- コード命名は本書の「コード表現」列に従う（`development-guidelines.md` §3 と整合）。

---

## 2. ドメイン用語（中核概念）

| 用語（日本語） | 英語 | コード表現 | 定義 |
|---|---|---|---|
| サブスクリプション | Subscription | `subscription` / `subscriptions` | 継続課金される契約。SubBuddy の管理対象の中心。金額・周期・更新日・重要度を持つ。 |
| 請求イベント | Billing Event | `billing_event` / `billingEvent` | ある時点の課金・請求の記録（金額・日付・出所）。履歴として保持。 |
| 利用量 | Usage | `usage` | サブスクがどれだけ使われたかを表すシグナルの総称。性質により軸が異なる（§3）。 |
| 利用量取得源 | Usage Source | `usage_source` | 利用量をどの軸で測るかの**概念的な種別**。`time` / `capacity` / `visit`（§3）。現状のデータモデル（`functional-design.md` §5）には未反映で、`visit` 採用時に追加する想定フィールド。 |
| 来館 | Visit | `visit` | 物理サービス（ジム等）の利用 1 回＝来館。`usage_source = visit`。位置情報ベースは**近似**。**候補・未確定**：ジムは PRD の現行対象外で、取得方法は保留（`.steering/20260601-anytime-fitness-visit-usage/`）。 |
| レコメンド（見直し情報） | Recommendation | `recommendation` / `recommendation_snapshot` | サブスクごとの確認優先度、事実、根拠、不足情報、選択肢。内部判定値は互換用で、利用者への最終判断ではない。 |
| スコアリング | Scoring | `scoring` | パターンマッチング（P1〜P7）で具体的な状況ごとにレコメンドを判定する処理。利用量は P1 の入力のひとつであり中核ではない。AI を使わない（MVP）。 |
| 観測期間 | Observation Window | `observation_days` | サブスク**登録時点から**の利用量集計の経過日数。過去には遡らない。 |
| 観測中 | Observing | `data_status = observing` | 観測日数が確定に必要な最小日数に満たず、利用ベース判定を未確定としている状態。画面では「観測中（あと N 日）」と表示。 |
| 確定 | Ready | `data_status = ready` | 観測が十分になり、利用ベースの判定を確定して出せる状態。 |
| サービスカタログ | Service Catalog | `service_catalog` | 既知サービスのマスタ（名称・カテゴリ・利用の性質等）。サブスク登録時のあいまい検索・自動設定に使用。 |
| サービスプラン | Service Plan | `service_plans` | 同一サービスの料金プラン情報。P3（安いプランがある）の判定に使用。無料プラン（`is_free_tier=true`）は比較対象から除外。 |
| 代替サービス | Service Alternative | `service_alternatives` | サービス間の代替関係。P4（安い競合がある）の判定に使用。 |
| 知識ベース | Knowledge Base | — | サービスカタログ・プラン・代替サービスの総称。P3・P4 の判定の情報源。料金の確認日（`verified_at`）から6ヶ月超過で信頼度を低下させる。 |
| 利用の性質 | Usage Type | `usage_type` | サブスクの使い方の分類（`active_foreground` / `active_background` / `active_other_device` / `passive` / `entitlement` / `capacity`）。P1 の適用可否を決定する。 |
| なくなったら困るか | Initial Value Answer | `initial_value_answer` | 登録時の1問（`very_important` / `somewhat` / `not_much`）。将来の判定拡張用に保持。 |
| カタログ紐付け | Matched Service | `matched_service_id` | サブスクがサービスカタログのどのサービスに対応するか。プラン・代替の自動取得に使う。 |
| プラン容量 | Plan Capacity | `plan_capacity_gb` | iCloud+ 等で契約中プランの容量（GB）。価格から逆算せず明示的に持つ（実効額が一意でないため）。任意。 |
| 使用容量 | Used Capacity | `used_capacity_gb` | 現在使用しているストレージ量（GB）。手入力／スクリーンショット読取で得る。容量ゲートの中心入力。任意。 |
| 容量確認日時 | Capacity Checked At | `capacity_checked_at` | 使用容量を確認した日時。鮮度判定に使う（しきい値超過で判定を弱める）。任意。 |
| 容量ゲート | Capacity Gate | — | 「安いプランがある」判定に使用容量の安全確認を足す仕組み。新パターンではなく既存判定の安全弁。収まる最小プランがあるときだけダウングレードを断定する。 |
| 容量ゲート確認状態 | Capacity Gate Status | `status`（判定根拠内） | ダウングレード提案の確からしさ。`confirmed`（容量確認済みで安全に提案）／`needs_capacity_check`（未確認・鮮度切れで様子見）。 |
| 重要度 | Importance | `importance` | ユーザーが付与する主観的な重要度。判定の補正係数に用いる。 |
| 利用量センサー | Usage Sensor | — | 利用量を計測する側の総称。iPhone（Screen Time・位置情報）が担う。 |
| 計測対象アプリ | Measured App | — | サブスクに対応する既存アプリ（Netflix・YouTube 等）。DeviceActivity で使用時間を測る対象。**SubBuddy 本体アプリとは別物**。1サブスク=1計測対象アプリで、対応付けは iOS 上のユーザー手動選択（`FamilyActivityToken` は不透明で bundleId を取れないため。ADR 0005）。 |
| SubBuddy 本体アプリ | Host App | — | iPhone に1つ入れる SubBuddy 本体アプリ。計測対象アプリと区別する。 |
| コネクタ / アダプタ | Connector / Adapter | `connectors/<source>` | 取得源ごとに利用量・請求を取り込む実装。原本を保持し、共通モデルへ正規化（`architecture.md` §5.1）。 |
| 取り込み | Ingestion | `ingestion` | 外部シグナルを検証・正規化して永続化する処理全体。単一窓口に集約。 |
| 正規化 | Normalize | `normalize` | 取得した原本を共通の利用量モデルへ変換すること。**遅延実行**し、入口で原本を捨てない。 |

---

## 3. 利用量の軸（`usage_source`）

利用量は対象サービスの性質により測る軸が異なる。**時間で測れないものを時間で測らない**ことが要点。

| 軸（コード値） | 日本語 | 何で測るか | 代表サービス | 単価指標 |
|---|---|---|---|---|
| `time` | 利用時間 | アプリ滞在時間（Screen Time / DeviceActivity の集計値） | 動画・音楽・SNS 等のアプリ系 | — |
| `capacity` | 容量 | 使用容量 / 上限 | iCloud+ 等のストレージ系 | — |
| `visit` ※候補 | 来館 | 来館日数（位置情報ベースの近似） | ジム（エニタイム等）の物理サービス | `cost_per_visit` |

> `time` の利用密度や `visit` の頻度から「割高かどうか」を評価する。判定の詳細は `functional-design.md` §8。
> **`visit` は候補・未確定**：ジムは PRD の現行対象外であり、来館取得（位置情報ベース）の採否は保留中（`.steering/20260601-anytime-fitness-visit-usage/`）。採用が確定するまで `time` / `capacity` を確定軸とする。

---

## 4. レコメンド判定値（`decision`）

> `decision`は既存データ・API互換の内部値である。利用者には「今確認したい」「更新前に確認したい」「情報が不足している」「現時点では急いで確認する材料が少ない」という確認優先度へ変換して表示し、継続・解約を断定しない。

スコアリングが出力する判定値。UI 表示・履歴・しきい値設計で同じ語を使う。

| コード値 | 日本語ラベル | 意味 |
|---|---|---|
| `keep` | 継続 | 妥当に使えている。見直し不要。 |
| `review` | 様子見 | 念のため確認したい状態。継続も解約もまだ判断しない。 |
| `consider_downgrade` | ダウングレード検討 | 上位プランが過剰。下位プランで足りる可能性。 |
| `consider_cancel` | 解約検討 | 利用が乏しく解約を検討すべき。 |
| `strong_cancel_candidate` | 強い解約候補 | 長期未使用等、解約を強く推奨。 |

各判定は P1〜P7 のパターンマッチングで導出される（§4a 参照）。

> SubBuddy は**自動解約を行わない**。判定は提案までで、実行はユーザーに委ねる（恒久方針）。
> **`観測中`（`data_status = observing`）は判定値ではなく別軸の状態**。利用ベース判定が未確定の間の表示で、確定後に上記いずれかの `decision` を出す（`functional-design.md` §8.5）。

---

## 4a. パターンマッチング判定（P1〜P7）

レコメンドは具体的な状況パターンで判定する。`usage_type`（利用の性質）に応じて適用可否を切り替える。

| パターン | 状況 | 判定 | 適用条件 |
|---|---|---|---|
| P1 | 使っていない（スパン内利用日数＋最終利用経過日数で判定） | 解約検討 | `active_foreground` / `active_background` のみ |
| P2 | 同カテゴリに複数あり割高 | 解約検討 | 全サブスク |
| P3 | 同サービスに安い有料プランがある | ダウングレード検討 | 知識ベースにプラン情報があるサブスク |
| P4 | 同カテゴリに安い有料競合がある | 乗り換え検討 | 知識ベースに代替情報があるサブスク |
| P5 | 年額更新が7日以内 | 更新前に見直し | 年額契約 |
| P6 | 月額¥2,000以上で12ヶ月以上継続 | 確認 | 全サブスク |
| P7 | 上記に該当なし | 継続 | — |

| `usage_type` | 意味 | P1 適用 |
|---|---|---|
| `active_foreground` | iPhone 前面で操作 | する |
| `active_background` | 裏で再生（音楽等） | 補助的に |
| `active_other_device` | PC/TV/Web で使う | しない |
| `passive` | 保管・同期・常時稼働 | しない |
| `entitlement` | 権利として保有 | しない |
| `capacity` | 容量ベース（iCloud+） | しない |

**判定根拠（Matched Pattern / `matchedPatterns`）**：判定時に当てはまったパターンの一覧。各要素は `pattern`（P1〜P6 の記号）・`label`（画面の根拠タグ文言。例「使っていない」）・`evidence`（具体的な根拠文）・`caveat`（任意の注意書き）を持つ。`recommendation_snapshots.matched_patterns`（jsonb）に保存し、画面の根拠タグと `reason`（理由文）の出どころになる（`reason` は `matchedPatterns` から組み立てる）。

---

## 5. 指標・計算用語

| 用語 | コード表現 | 定義 |
|---|---|---|
| 1 利用日あたり単価 | `cost_per_usage_day` | 月額 ÷ 利用日数。参考指標（パターン判定の直接の入力ではない）。 |
| 1 来館あたり単価 | `cost_per_visit` | 月額 ÷ 来館日数。ジム等の割高度の目安。**`visit` 採用時に有効**（§3。現状の `recommendation_snapshots` には未定義）。 |
| 未使用日数 | `unused_days` | 最終利用からの経過日数。P1 パターン判定の入力（`usage_type` が能動前面/背景の場合のみ）。 |
| 更新日 | `renewal_date` | 次回課金日。接近時に確認を促す。 |
| 信頼度 / 近似フラグ | `confidence` / `is_approximate` | 値が確定値か近似（例：位置情報ベースの `visit`、観測期間が短い間の暫定値）かを表す。 |
| 観測日数 | `observation_days` | 登録時点からの利用量集計の経過日数。確定までの残り日数は `days_until_ready`。 |
| 支出可視化 | （画面 `/spending`・F-12） | 継続中サブスクの支出を複数の切り口で見せる機能。`domain/spending` が集計。 |
| 月次推移 | `monthlyTrend` | 各月末時点で登録済みかつ継続中の契約の月額換算合計（登録の積み上がりを表す）。 |
| カテゴリ別内訳 | `byCategory` | カテゴリごとの月額合計と構成比（`share`）。 |
| 年額見込み | `yearlyTotal` | 継続中契約の年額換算合計。 |

---

## 6. デプロイ・運用用語

| 用語 | 定義 |
|---|---|
| ローカルファースト | まず local mode で価値を確認し、同一コードベースのまま cloud-testflight mode へ進める方針。 |
| MVP | ローカル・単一ユーザーで成立させる最小構成。常設の Mac（Mac mini 等）をサーバーとする local mode で価値を確認する段階。 |
| 小規模検証版 | TestFlight で 20〜50 人程度に配布する最初の検証版。一般公開前に、クラウド多ユーザー基盤・iPhone 連携・プライバシー説明・運用サポートの失敗パターンを集める段階。 |
| local mode | 開発者・自分用に同一コードベースをローカル実行するモード。ローカル PostgreSQL とローカル簡易認証を使うが、API 契約・Prisma schema・Zod schema・ドメインロジックはクラウド版と共通にする。 |
| cloud-testflight mode | 小規模検証版を動かすクラウド実行モード。PaaS、マネージド PostgreSQL、Apple サインイン、デバイス同期トークンを使い、TestFlight 配布の検証対象にする。 |
| production mode | 将来の一般公開版を動かすクラウド実行モード。`cloud-testflight mode` を基礎に、監視・運用・法務/プライバシー対応・サポート体制を強化したもの。 |
| ポストMVP | MVP 後の段階。まず小規模検証版をフルクラウドで配布し、その後 production mode の一般公開版へ進む。マルチテナント・正式認証・PII 保護を伴う。 |
| マルチテナント | 1 つのアプリ/DB で複数ユーザーのデータを `user_id` で分離して扱う構成。 |
| Worker | スコアリング等を実行する処理単位。MVP は API 内同居、フェーズ2 で分離可能（`architecture.md` §7）。 |
| Apple サインイン | クラウド配布版の主ユーザー認証。Apple の stable identifier と SubBuddy の `users.id` を紐付け、メールアドレスを必須識別子にしない。 |
| AuthenticatedActor | Route Handler 以降で使う認証済み主体の内部モデル。`user` と `device` を区別し、認証方式の違いをアプリ内部へ散らさない。 |
| デバイス登録 | Apple サインイン済みユーザーが iPhone を SubBuddy アカウントに紐付け、利用量同期用のデバイス同期トークンを受け取る操作。 |
| デバイス同期トークン | iPhone が利用量集計値を送るための bearer token。サーバーでは平文保存せず `token_hash` として保存し、失効・再発行できる。 |
| デバイス失効 | 登録済み iPhone のデバイス同期トークンを無効化し、以後の利用量送信を止める操作。アカウント削除とは別物で、サーバー上のサブスク・利用量データは削除しない。 |
| テナント分離 | 複数ユーザーのデータを `user_id` で分離し、認証済みユーザーまたはデバイスに属するデータだけを読み書きさせる制約。 |

---

## 7. データ・プライバシー用語

| 用語 | 定義 |
|---|---|
| PII | 個人を特定し得る情報。実 PII はリポジトリに置かず、実行モードに応じて local DB またはクラウド DB に保存する（`AGENTS.md`）。 |
| 機微データ | 支出・利用状況・メール等の取り扱い注意データ。合成データのみを開発に使う。 |
| 集計値 | iPhone が SubBuddy API へ送る、詳細ログを含まない要約値（利用日・バケット・来館日数等）。 |
| usage_date | iPhone 現地時刻で確定した利用日。サーバーは受け取った日付を変換せず保存する。 |
| アカウント削除 | Apple サインイン済みユーザーが SubBuddy のアカウントと紐づく全データを削除する操作。`devices` の失効だけでなく、`subscriptions`・`billing_events`・`ios_usage_daily_summaries`・`recommendation_snapshots`・`users` を物理削除する。 |
| 合成（ダミー）データ | 実在しない検証用データ。seed・fixture・テスト・スクショに用いる唯一のデータ。 |
| 秘密情報 | トークン・資格情報・ID/PW 等。コミットせず環境変数で管理。外部 ID/PW は**保存しない**。 |

---

## 8. UI / UX 用語

| 用語 | 英語 | 定義 |
|---|---|---|
| ダッシュボード | Dashboard | サブスク一覧・支出・レコメンドを俯瞰する Web 画面。 |
| サブスクカード | Subscription Card | 一覧で 1 サブスクを表すカード UI コンポーネント。 |
| 計測対象選択 | Activity Picker | iPhone で計測対象アプリ/Web を選ぶ操作（FamilyActivityPicker。UC-09）。 |

---

## 9. 用語の使い分け（混同しやすい組）

- **利用量取得源（`usage_source`）と コネクタ名**：軸は `time/capacity/visit`、コネクタ名は取得源（`screen-time`/`icloud`/`gym-visit`/`billing-email`）。**別物**として命名する。
- **来館（`visit`）と アプリ滞在（`time`）**：ジムは「アプリを開いた時間」ではなく「来館」で測る。混同しない。
- **正規化値と原本**：判定は正規化値で行うが、原本（生データ）は捨てずに保持する（後からの新メトリクスに備える）。
- **レコメンド（提案）と 自動実行**：SubBuddy は提案まで。解約等の実行はしない。

## 9. リリース・運用用語

| 用語 | 定義 |
|---|---|
| 中心価値 | ユーザーが支出を把握し、優先して確認すべき契約と根拠を理解して、自分で見直し判断を進められること。 |
| 見直し支援 | 事実、確認優先度、根拠、分からないこと、選択肢を示す情報提供。解約・継続の最終判断や代行ではない。 |
| 確認優先度 | SubBuddyが持つ情報から、どの契約をいつ確認したいかを示す順序づけ。継続・変更・解約の結論ではない。 |
| 有効参加者 | 募集条件を満たし、TestFlight参加に同意して初回サインインを完了した人。途中離脱者も除外しない。 |
| 一般公開移行基準 | TestFlightの結果から同じ製品方針で一般公開準備へ進めるかを判断する内部基準。Appleの審査基準ではない。 |
| 社内実機確認 | 外部配布前に実機でサインインから削除までと故障時の安全性を確認する段階。 |
| TestFlight小規模検証 | 20〜50人の招待参加者で価値、信頼、運用可能性を確認する限定リリース。 |
| 一般公開 | 日本のApp StoreとWebで不特定の対象ユーザーへ継続提供する段階。 |
| 主計測iPhone | Screen Timeの集計値を送る1台のiPhone。閲覧・編集端末とは区別する。 |
| 削除専用コード | Apple認証不能時に完全削除だけを申請するコード。ログイン、閲覧、復旧には使えない。 |
- **SubBuddy 本体アプリと 計測対象アプリ**：SubBuddy 本体アプリは iPhone に1つ入れるホストアプリ。計測対象アプリは Netflix / YouTube 等の既存アプリで、サブスクごとにユーザーが手動で選ぶ。
- **デバイス失効と アカウント削除**：デバイス失効は同期トークンを無効化して送信を止める操作。アカウント削除は user に紐づく全データを削除する操作。
- **`app_bundle_ids` と 計測対象の確定**：`app_bundle_ids` は候補ヒントであり、自動突合の正本ではない。DeviceActivity のトークンから bundleId は取得できないため、計測対象の確定は iOS 上のユーザー手動選択で行う。

---

## 10. WBS・進捗管理用語

開発進捗を管理する WBS 同期の仕組みで用いる語。詳細は `development-guidelines.md` §8 / `repository-structure.md` §6。

| 用語 | 英語 / コード表現 | 定義 |
|---|---|---|
| WBS | Work Breakdown Structure | 開発作業を階層的に分解した進捗管理表。SubBuddy では開発タスクのメタ情報のみを扱う（PII は含めない）。 |
| WBS 正本 | Source of Truth（`wbs/wbs.yml`） | 進捗の単一の真実。人と AI が編集し Git で履歴管理する。Sheets はここから生成される。 |
| WBS ID | `id` | 各タスクの不変の識別子。並べ替え・改名しても変えない。同期の結合キー。 |
| Sheets ビュー | Sheets View | `wbs.yml` から生成される人間向けの Google スプレッドシート表示。片方向同期の出力先。 |
| 計画リポジトリ | Planning Repository（`SubBuddy-planning`） | 進捗・計画・構造図を非公開で見るための GitHub リポジトリ。正本ではなく、`wbs.yml` と公開 docs から生成される閲覧用の同期先。 |
| 片方向整流 | One-way Reconciliation | 正本から同期先へ一方向に反映し、同期先を直接編集しても次回同期で正本の内容に戻す運用。 |
| 同期 | Sync | `wbs.yml`（spec）の内容を Sheets へ反映する処理。片方向（spec → Sheets）・冪等。 |
| 確認ゲート | Confirmation Gate | Sheets へ書き込む前に差分を提示し、ユーザー承認を必須とする仕組み（承認なしには書かない）。 |
| 自動トリガ | Auto Trigger | `.steering/*/tasklist.md` の全完了を検知して同期を提案するフック。提案のみで、書き込みは確認ゲートを通る。 |
| Bolt | Bolt | AI-DLC における作業の単位（スプリント相当）。本プロジェクトでは `.steering/*/tasklist.md` 1 件の完遂を指す。 |
| アーカイブ | Archive | spec から消えたタスクを `WBS` シートから退避させる先（`Archive` シート）。履歴を残す。 |

### 10.1 ステータス語彙（`status`）

WBS タスクの状態。`wbs.yml`・Sheets・タスクリストで同じ語を使う。

| コード値 / 語 | 定義 |
|---|---|
| 未着手 | 未着手（タスクリストの `[ ]`）。 |
| 進行中 | 着手済みで未完了（タスクリストの `[~]`）。 |
| 完了 | 完了（タスクリストの `[x]`）。自動トリガの全完了判定の対象。 |
| 保留 | 当面着手しない（タスクリストの `[-]`）。全完了判定をブロックしない。 |

---

> 新しいドメイン語・判定値・軸を追加するときは、必ず本書に追記し、コード・UI・他ドキュメントと表記を一致させること。
