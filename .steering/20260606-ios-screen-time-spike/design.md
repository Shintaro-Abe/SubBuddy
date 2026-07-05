# iOS Screen Time Spike — 設計（design）

> ステアリング：`20260606-ios-screen-time-spike`
> ドキュメント種別：作業単位ドキュメント（`.steering/`）
> 作成日：2026-06-06
> 前提：`requirements.md`（承認済み）、`research/20260605-ios-screen-time-spike/investigation.md`（技術調査・戦略）
> 関連：`docs/architecture.md`（§2/§3.2/§8.1.1）、`docs/repository-structure.md`（§5）

> 📖 読み方：専門用語は残し、初出に「（＝平たい言い換え）」を添える。要求（requirements）で決めた範囲・合格ラインを、**どう作って・どう実機で確かめるか**に落とす文書。コードは書かない（設計と段取りまで）。実機作業はユーザー、Claude は設計・手順・記録テンプレを用意（`verify`/`run` はしない）。

---

## 1. このドキュメントの位置づけ

`requirements.md` で決めた「**技術的に実現できるか（配管が動くか）**」を、最小の使い捨て試作で確かめるための**作り方と検証段取り**を定義する。合格ライン（§4.1 の MUST 9／SHOULD／NICE）を、**誰が・何を・どう測れば OK/NG を判定できるか**まで具体化する。

- 本ステアリングは「配管（技術）」のみ。適性（どのサブスクに P1 を適用するか）はパターン判定方式（`.steering/20260609-quantitative-recommendation-engine/`）で**解決済み**（`usage_type` で制御）。
- 本ステアリングの go は技術成立のみで判断し、go 判定が出れば本格実装に進む（`requirements.md` §1・§6.1 D4）。

---

## 2. 実装アプローチ（全体構成）

### 2.1 コードの置き場所（使い捨て）

- 使い捨ての検証用ディレクトリ `spikes/ios-screen-time/`（＝go 判定が出たら本実装で `apps/ios/` を正式新設し、使い捨ては破棄）。
- `apps/web`（Mac 側の既存コード）は**触らない**。Spike は Mac 側の既存契約に「合わせる」側。

### 2.2 iOS 側コンポーネントと責務

> いずれも `spikes/ios-screen-time/` 配下に最小実装（製品品質は問わない）。

| コンポーネント | 役割（平たく） | 主な技術 |
|---|---|---|
| 本体アプリ（最小UI） | 許可取り・対象選択・状態表示・送信を起こす入口 | SwiftUI |
| 認可（Authorization） | iOS に計測の許可を求める | `AuthorizationCenter.requestAuthorization(for: .individual)` |
| 対象選択（Picker） | 計測したいアプリをユーザーが1つ選ぶ | `FamilyActivityPicker` → `FamilyActivitySelection` |
| 監視登録（Scheduler） | 「○分使ったら通知」を登録する | `DeviceActivityEvent`＋`DeviceActivityCenter.startMonitoring` |
| Monitor 拡張（裏で動く小プログラム） | 到達通知を受け、共有置き場に集計を書く | `DeviceActivityMonitor.eventDidReachThreshold` |
| 共有置き場（App Group） | 拡張と本体が受け渡しするデータ置き場 | App Group（`UserDefaults(suiteName:)`／共有ファイル） |
| ローカル保存（Mapping/State） | 対応表（サブスク↔選択）・同期状態・未送信キュー | SwiftData（または最小の保存）|
| 送信（Sync） | 集計を Mac の窓口へ送る | `URLSession` → `POST /api/usage/daily` |

### 2.3 データの流れ（再掲・確定）

```
[Monitor 拡張]  ──①書く──▶  [App Group]  ──②読む──▶  [本体アプリ]  ──③送る──▶  [Mac: POST /api/usage/daily]
 eventDidReach              当日・対象ごとの            フォアグラウンド          既存 usageDailyBatchSchema
 Threshold で発火           「到達した最上位段階」を      で読み取り→JSON化         (subscriptionId,usageDate) 冪等保存
                           単調更新で記録               未送信は貯めて再送
```

- **集計するのは拡張、送るのは本体**（拡張は短命・非力なので通信させない）。
- 送るのは**まとめた数字と subscriptionId だけ**（アプリ名・トークンの中身は送らない＝TC-3）。

---

## 3. 検証の進め方（go/no-go を埋める段取り）

### 3.1 段階の順序（安い順・落ちたら止める）

| 段階 | 内容 | 主に埋まる合格ライン | 落ちたら |
|---|---|---|---|
| 段階0 | 環境準備（Apple Developer 有料・実機・App Group・dev entitlement・署名） | 前提 | 進めない（環境を整える） |
| 段階1（最優先） | A1＝拡張→App Group→本体読取（複数同時到達・再起動後） | MUST-1 | **no-go 判断・以降中止** |
| 段階2 | 最小縦割り（許可→Picker→1閾値→通知ログ→読取→表示） | AC-2 | 縦割りが通らない原因を切り分け |
| 段階3 | 復旧・許可失効（再起動/kill/更新→再アーム、取消→再対応づけ） | MUST-2, MUST-8 | 該当 MUST no-go |
| 段階4 | 測定精度（三点照合・日付境界）と「ゼロ日」の判別 | MUST-3, MUST-4, MUST-5 | 該当 MUST no-go／縮退写像を検討 |
| 段階5 | スケール限界試験（N×M をどこまで・メモリ） | MUST-6 | 上限を下げる／no-go |
| 段階6 | 同期堅牢性（不通・Mac停止・再起動→再送・冪等） | MUST-7 | 該当 MUST no-go |
| 段階7 | 配布見込み（entitlement 用途説明・PrivacyInfo 草案） | MUST-9 | 見込み立たねば方式再考 |

> SHOULD（S-1〜5）・NICE（N-1〜3）は各段階に付随して可能な範囲で確認・記録する。

> **方針更新（2026-06-16）：まずローカルファーストで構築する。**
> 段階7（配布見込み・MUST-9）は机上で完了し「配布見込みあり」を確認済み（`stage7-main-distribution-guide.md`）。
> ローカルファースト構成（自分の iPhone で動かす）では Apple への配布申請は不要なため、**段階7は当面オフ**にする。
> 当面の go/no-go の本体は **段階3・4・5 と段階1・6 の残項目**（実機検証）。手順と記録テンプレは `field-test-guide.md` にまとめる。
> 段階5（スケール限界・MUST-6）は、自分用は監視対象が数件のため**優先度を下げ**、合否ではなく「安全上限を実測して MVP スコープに記録」する位置づけにする。

### 3.2 各 MUST の「測り方」と「OK/NG の見方」

| ID | 実機で何をするか（手順の骨子） | OK と言える基準 | NG（no-go）の例 |
|---|---|---|---|
| MUST-1 | 1対象を監視→対象アプリを使い閾値到達→拡張が App Group に「日付/段階/連番」を書く→本体が読む。これを複数同時到達・本体/端末再起動を挟んで複数日繰り返す | 全到達が欠落なく本体から読め、再起動後も残る | 単発しか読めない／同時到達で抜ける／再起動で消える |
| MUST-2 | 監視中に iPhone 再起動・アプリ kill・アプリ更新→状態確認→必要なら再アーム | 状態が分かり、再アームで復旧。当日値を壊さない | 再アームで当日値リセット／二重登録 |
| MUST-3 | 対象を 0/16/31/61/121 分 使う→ ①手計測 ②設定アプリ Screen Time 表示 ③通知ログ を突き合わせ（三点照合）を7日 | 有効7日中6日が1段階以内。境目のズレを説明できる | ズレが大きく理由も不明 |
| MUST-4 | 日跨ぎ直前直後・タイムゾーン変更を試す | 利用が iPhone 現地日付で正しい1日に入る | 別日にずれて保存される |
| MUST-5 | 通知を二重/順不同で起こす・同じ内容を再送 | 端末側は上がる方向のみ・DB側は段階が下がらない・重複行なし | 過大計上・重複行 |
| MUST-6 | 監視対象と閾値を段階的に増やす（例 5→10→20 サブスク × 4 閾値） | 想定上限で `startMonitoring` がエラーにならず取りこぼさない | 想定の半分未満で失敗＋検知/縮退なし |
| MUST-7 | 送信を不通・Mac 停止・アプリ再起動を挟んで行う | 未送信を貯めて再送し、冪等保存で帳尻が合う | 欠損が気づかず貯まる |
| MUST-8 | 設定で許可を取り消す→検知→再許可→対象選び直し→既存サブスクと結び直し | 取消検知し、再対応づけで復旧 | 既存サブスクの監視/対応を復元できない |
| MUST-9 | entitlement 申請用の用途説明と `PrivacyInfo.xcprivacy` の草案を作り、Apple 公式要件と突き合わせ | 説明と申告が矛盾せず「節約」用途を説明しきれる見込み | parental-controls 文脈とのズレを説明しきれない |

---

## 4. データ構造（Spike で扱う最小の形）

> いずれも Spike 用の最小形。製品のデータモデルは別ステアリング/本実装で確定。

### 4.1 共有置き場（App Group）に書く1レコード（拡張→本体）

| 項目 | 意味 |
|---|---|
| `activityId` | どの監視か（＝subscriptionId に1対1） |
| `eventId` | どの閾値の通知か（例 `15m_plus`） |
| `date` | iPhone 現地日付（YYYY-MM-DD） |
| `bucket` | その日に到達した最上位段階（単調更新） |
| `generatedAt` | 拡張が書いた時刻 |
| `sequence` | 連番（取りこぼし・重複検知用） |

### 4.2 本体ローカルの対応表（機微情報・Mac へ送らない）

| 項目 | 意味 |
|---|---|
| `subscriptionId` | Mac 側のサブスク ID（cuid） |
| `selection` | `FamilyActivitySelection`（Codable で保存・中身は不透明トークン） |
| `activityName` | 監視名（`sub_<subscriptionId>` で1対1） |

> ⚠️ この対応表は「どのサブスク＝どのアプリを選んだか」を含むため**機微**。**iPhone ローカル限定**で保持し、Mac へは送らない（`requirements.md` §6.1 D4／別ステアリングの適性とも整合）。

### 4.3 Mac へ送る JSON（既存契約に合わせる・変更しない）

`POST /api/usage/daily` の既存 `usageDailyBatchSchema` にそのまま適合:

| 項目 | 値の作り方 |
|---|---|
| `subscriptionId` | 対応表から |
| `date` | App Group の `date`（iPhone 現地日付） |
| `usageBucket` | App Group の `bucket`（ワイヤ形式 `none/15m_plus..`） |
| `used` | `bucket != none` |
| `estimatedMinutesMin` | バケット下限（既存 `USAGE_BUCKET_LOWER_MINUTES`） |
| `estimatedMinutesMax` | 次バケット下限−1（最上位は省略） |
| `source` | `"ios_device_activity"` |

- 再送は既存の冪等保存（`(subscriptionId, usageDate)` upsert）で安全。**段階が下がらない**ことは MUST-5 で確認（DB 側 `max(段階)` の要否はここで判断材料を出す）。

---

## 5. 同期方式の設計（Q4 の design 内決定）

**採用（本命）：QR ペアリング＋証明書ピン留め。検証スピード優先で、Spike 中だけ中継トンネル（Tailscale 等）を許容。本番採用は別判断。**

| 方式 | 内容 | 位置づけ |
|---|---|---|
| QR ペアリング＋証明書ピン留め | Mac が QR（共有シークレット＋証明書 fingerprint）を表示→iPhone が初回に取り込み、以後その証明書だけ信頼 | **本命**（ローカルファースト・自己署名でも安全に運用） |
| 中継トンネル（Tailscale 等） | 端末間を安全につなぐ中継を一時利用 | **Spike 中の検証用のみ**（到達性検証を速くするため。本番採用は別判断） |
| 平文 HTTP | — | **不採用**（集計値でも平文に出さない） |

- 認証：事前共有トークン（`USAGE_SYNC_TOKEN`）を `Authorization: Bearer` ヘッダで送る。Mac 側のトークン検証は**実装済み**（RE-11.3、コミット `937cfe9`）。Spike では既存の認証に合わせて送信する。
- iOS 14 以降の Local Network Privacy 許可ダイアログ（同一ネット内通信の許可）に注意。

---

## 6. 計測・ログの様式（go/no-go を主観にしない）

- 各段階の結果を、**結果（OK/NG/要追検証）＋再現手順＋証跡**の形で `requirements.md`／`investigation.md`（`20260605-ios-screen-time-spike`）の検証欄に記録する。
- **三点照合表**（MUST-3 用）：日付ごとに「①手計測の分／②設定アプリ Screen Time／③通知ログから推定した段階」を並べ、ズレと理由を書く。
- **検証環境の記録**：iPhone 機種・iOS ビルド・Xcode・Developer Program 状態・許可種別（`.individual`）。`requirements.md` には固定値を書かない方針なので、**結果側に記録**する。
- 実機ログ・スクショは**アプリ名 Label や利用傾向が混じりうる**ため、**Git 管理しない／必要時はマスキング・合成化**（PII 方針）。

---

## 7. 影響範囲の分析

| 対象 | 影響 |
|---|---|
| `apps/web`（Mac 側既存コード） | **変更しない**（合わせる側）。送信窓口のトークン検証は実装済み（RE-11.3） |
| `spikes/ios-screen-time/`（新規・使い捨て） | 新規作成。go 後に破棄し `apps/ios/` を正式新設 |
| `docs/`（architecture/glossary 等） | **今は変更しない**。Spike 結果が確定してから追記要否を判断 |
| DB スキーマ | **変更しない**（Spike は既存契約に送るだけ）。適性分類によるスキーマ変更は別ステアリング |
| 適性（usage_type による P1 適用可否） | パターン判定方式で解決済み。本ステアリングの「ゼロ日の機械的判別」結果は P1 判定ロジックの入力になる |

---

## 8. 成果物（このステアリングで残すもの）

- 実機検証ログ（段階別・結果/再現手順/証跡）
- 三点照合表（測定精度）
- スケール限界試験の結果表（N×M の上限・メモリ）
- 同期方式の比較・選定メモ（QR ピン留め vs トンネル）
- `PrivacyInfo.xcprivacy` と entitlement 用途説明の草案（配布見込み）
- go/no-go 判定表（MUST 9 の各 OK/NG と総合判定）
- MVP 確定スコープ（単一アプリ・15分以上・iPhone 日付基準・フォアグラウンド主経路・対象数上限）と `docs/` 追記候補・縮退方針

---

## 9. 未決定の決着・リスク

### 9.1 Q3（1分・5分バケット）の design 内決定

**採用：1分・5分は「鳴るか実測する」までにとどめ、MVP の製品判定には採用しない（15分以上に寄せる）。** 理由：DAM の約15分下限で発火信頼性が低い（`investigation.md`）。MUST-3 の精度検証も 15分以上で評価する。

### 9.2 リスク（design 視点）

| リスク | 対応 |
|---|---|
| 段階0（環境・署名・App Group）でつまずき検証が始まらない | 環境準備チェックリストを段階0として独立化し、先に潰す |
| A1（MUST-1）が NG だと配管が成立しない | 段階1を最優先・最初の go/no-go ゲートに（落ちたら即中止） |
| 三点照合の「真値」が曖昧 | 手計測を一次基準、Screen Time 表示は補助、通知ログと突き合わせ（3点で相互補正） |
| 実機検証が伸びる | 段階ごとの timebox を tasklist で設定（例 段階1=3日、段階4=7日） |
| 実機ログに機微が混じる | Git 管理外・マスキング徹底 |

---

## 10. 重要ファイル（新規想定・提案のみ／差分は書かない）

**新規（使い捨て `spikes/ios-screen-time/`）**
- 本体最小アプリ（認可・Picker・状態表示・送信起動）
- 監視登録（DeviceActivityEvent／startMonitoring）
- Monitor 拡張（eventDidReachThreshold → App Group 書込）
- 共有置き場アクセス（App Group 読み書き）
- 送信（URLSession → POST /api/usage/daily・未送信キュー・証明書信頼評価）
- `PrivacyInfo.xcprivacy`（草案）

**参照（変更しない・合わせる先）**
- `apps/web/src/schemas/usage.ts`（送る JSON の形）
- `apps/web/src/lib/usage-bucket.ts`（段階の表し方・下限分）
- `apps/web/src/app/api/usage/daily/route.ts`（送信窓口）
- `apps/web/prisma/schema.prisma`（保存先・冪等キー）

**記録先**
- `.steering/20260606-ios-screen-time-spike/`（検証結果・判定表）
- `research/20260605-ios-screen-time-spike/investigation.md`（検証欄）
