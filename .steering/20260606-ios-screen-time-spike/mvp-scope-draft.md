# MVP 確定スコープ（草案・tasklist 8-2）

> 置き場所：`.steering/20260606-ios-screen-time-spike/`
> 作成日：2026-06-16
> 担当：Claude Code（テックリード／プロダクト視点で整理）
> この文書の役割：iOS 利用量取得を**本実装（`apps/ios/`）に進めるとき**の MVP スコープを先に固める草案。
> go が確定したら、ここを起点に `docs/`（architecture/glossary）へ追記する。

---

## 0. 位置づけ（重要）

- **これは草案。** 最終 go/no-go はまだ確定していない（段階3・4・5＋段階1・6 残項目の実機検証が必要 → `field-test-guide.md`）。
- **方針：まずローカルファーストで構築する**（自分の iPhone で動かす。配布は後回し）。本スコープはその前提で書く。
- **実機検証で確定する値は「TBD（実測待ち）」と明記**する。実機結果が出たら、TBD を埋めて確定版にする。

---

## 1. 確定スコープ（ローカルファースト前提）

| 項目 | MVP の決め | 根拠・補足 |
|---|---|---|
| 監視対象 | **1サブスク＝1アプリ（単一 ApplicationToken）** | 不透明トークンは合算できない。複数アプリ合算・カテゴリ・Web サイト対象は MVP 除外（`requirements.md` §2.2） |
| 利用量の粒度 | **「15分以上」から（バケット下限15分）** | DeviceActivity の約15分下限。1分・5分は「鳴るか実測」までで製品不採用（`design.md` §9.1） |
| 段階（バケット） | 15 / 30 / 60 / 120 分の到達段階を**単調更新**（上がる方向のみ） | 既存 `usage-bucket` のワイヤ形式に合わせる |
| 日付基準 | **iPhone 現地日付で確定。Mac で再解釈しない** | 日跨ぎ・TZ で別日にずれないため（MUST-4） |
| 送信の主経路 | **アプリを開いた時（フォアグラウンド）に送る** | 拡張は短命・非力なので通信させない。裏送信（BackgroundTasks）は将来の補助（`requirements.md` §2.2） |
| 同期方式 | **QR ペアリング＋証明書ピン留め（本命）** | ローカルファースト・自己署名でも安全に運用（`design.md` §5）。Spike 中のみ中継トンネルを検証用に許容 |
| 認証 | 事前共有トークン `USAGE_SYNC_TOKEN` を `Authorization: Bearer` で送る | Mac 側は実装済み（RE-11.3 / `937cfe9`） |
| 認可 | **`.individual`（本人の端末を本人が許可）** | 子の見守りではなく本人の自己計測 |
| 監視対象数の上限 | **TBD（実測待ち）**／暫定 3〜5 件 | 段階5（`field-test-guide.md`）の実測で確定。ローカルファーストでは数件で足りる |
| 配布 | **当面なし（ローカルファースト）** | 将来配布する場合の手順は `stage7-main-distribution-guide.md`（机上完了・配布見込みあり） |

---

## 2. データ契約（Mac 側の既存に合わせる・変更しない）

- 送信窓口：`POST /api/usage/daily`（既存 `usageDailyBatchSchema` に適合）。
- 送る中身：**まとめた数字と `subscriptionId` だけ**。アプリ名・トークンの中身は送らない（TC-3）。
- 主なフィールドの作り方（`design.md` §4.3）：

| 項目 | 値の作り方 |
|---|---|
| `subscriptionId` | iPhone ローカルの対応表から |
| `date` | App Group の `date`（iPhone 現地日付） |
| `usageBucket` | App Group の `bucket`（`none/15m_plus..`） |
| `used` | `bucket != none` |
| `estimatedMinutesMin` | バケット下限（既存 `USAGE_BUCKET_LOWER_MINUTES`） |
| `estimatedMinutesMax` | 次バケット下限−1（最上位は省略） |
| `source` | `"ios_device_activity"` |

- 保存は冪等：`(subscriptionId, usageDate)` で upsert。**段階は下がらない**（MUST-5 で確認）。

---

## 3. プライバシー設計（MVP 前提）

- iPhone から出るのは**集計値のみ**。アプリ名・詳細ログ・トークンの中身は端末に留める。
- 「どのサブスク＝どのアプリを選んだか」の対応表は**機微情報**。**iPhone ローカル限定**で保持し Mac へ送らない（`design.md` §4.2）。
- 送信先は本人の Mac（同一ネットワーク）。第三者送信・広告・追跡なし。
- （配布時のみ）プライバシー説明ファイル・App Store 表示は `stage7-main-distribution-guide.md`。ローカルファーストでは不要。

---

## 4. 実機検証で確定する項目（TBD 一覧）

go が出たら、`field-test-guide.md` の結果から次を埋めて確定版にする。

| TBD 項目 | 出典の検証 | 確定値 |
|---|---|---|
| 監視対象数の安全上限 | 段階5（5-1〜5-3） | ＿件 |
| 測定誤差の実績（1段階以内の達成日数） | 段階4（4-1 三点照合） | ＿/7 日 |
| 「ゼロ日／未同期／監視停止」の判別シグナル | 段階4（4-5） | （確定した見分け方） |
| 再起動・許可失効からの復旧手順の確定形 | 段階3（3-1/3-3） | （確定した導線） |
| 再送・Mac 停止耐性の実績 | 段階6（6-2/6-3） | OK/要対策 |

---

## 5. go 確定後の `docs/` 追記候補

| 追記先 | 追記内容（候補） |
|---|---|
| `docs/architecture.md` | iOS 利用量取得の構成（DeviceActivity → App Group → 本体 → `POST /api/usage/daily`）、同期方式（QR ピン留め＋Bearer）、対象数上限 |
| `docs/glossary.md` | DeviceActivity / App Group / バケット / `.individual` 認可 / `source=ios_device_activity` などの用語 |
| `docs/product-requirements.md` | 非機能（集計値のみ送信・対応表はローカル限定）の確定反映（必要なら） |

> 追記は go 確定後にまとめて行う（`design.md` §7：Spike 中は docs を変更しない方針）。

---

## 6. no-go の場合の縮退方針（→ 詳細は 8-3 で別途）

- パターン判定方式の利用量パターン（自動取得前提のもの）を見送り、**他パターン中心の運用＋手動記録／Shortcuts 補助**に切り替える。
- 利用量は「見直し優先度」の一要素であり中核ではない（戦略再定義済み）。自動取得が no-go でもプロダクトは成立する設計。
- 詳細な代替方式は tasklist 8-3 で整理する（本草案の範囲外）。
