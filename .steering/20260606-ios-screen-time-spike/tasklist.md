# iOS Screen Time Spike：タスクリスト

> ステアリング：`.steering/20260606-ios-screen-time-spike/`
> 作成日：2026-06-13
> 前提：`requirements.md`・`design.md`（承認済み）

> ⚠️ 実機作業（ビルド・検証）はユーザーが Mac/iPhone で実施。Claude Code は設計・手順書・記録テンプレ・判断支援を担当し、ビルド・実行はしない。

> 📌 **方針（2026-06-16）：まずローカルファーストで構築する。** 段階7（配布見込み）は机上完了・当面オフ。
> 当面の go/no-go の本体は **段階3・4・5＋段階1・6 の残項目**（実機）。手順と記録は `field-test-guide.md`、
> go 後の確定スコープは `mvp-scope-draft.md` にまとめる。詳細は `requirements.md` §4.1 の方針更新を参照。

---

## 段階0：環境準備

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 0-1 | Apple Developer Program（有料）の加入状態を確認する | 有料メンバーシップが有効 | ユーザー | 完了 |
| 0-2 | Xcode プロジェクトを `spikes/ios-screen-time/` に新規作成する | SwiftUI の空アプリが実機でビルド・起動できる | ユーザー | 完了 |
| 0-3 | App Group を設定する（Provisioning Profile + Entitlements） | 本体アプリと Monitor 拡張で同じ App Group ID を共有 | ユーザー | 完了（`group.com.subbuddy.SubBuddySpike`） |
| 0-4 | Family Controls の dev entitlement を有効化する | Xcode の Signing & Capabilities に Family Controls が追加されている | ユーザー | 完了 |
| 0-5 | DeviceActivityMonitor Extension ターゲットを追加する | 拡張ターゲットが作成され、本体と同じ App Group・Family Controls entitlement を持つ | ユーザー | 完了 |
| 0-6 | 実機ビルド・署名の動作確認（空アプリ＋空拡張が実機で起動） | iPhone 上で空アプリが起動し、拡張がプロセスとして認識される | ユーザー | 完了（PLA 同意・実機信頼の手順あり。下記「実機検証メモ」参照） |

---

## 段階1：受け渡しの堅牢性（MUST-1 — 最優先。ここが落ちたら即 no-go）

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 1-1 | App Group への書き込みコード（拡張側）を実装する | `activityId/eventId/date/bucket/generatedAt/sequence` を App Group（UserDefaults + ファイル両方式）に書ける | Claude（設計）+ ユーザー（実装） | 完了 |
| 1-2 | App Group からの読み取りコード（本体側）を実装する | 本体アプリが拡張の書いたレコードを全件読み取れる | Claude + ユーザー | 完了 |
| 1-3 | 単発到達の書込→読取を実機で確認する | 1対象・1閾値で到達→本体が読める | ユーザー | 完了（「レコード数1」を実機で確認） |
| 1-4 | 複数同時到達で取りこぼしがないことを確認する | 複数閾値が短時間に到達しても全件読める | ユーザー | 未検証 |
| 1-5 | 本体再起動後もデータが残ることを確認する | 本体 kill → 再起動 → 読取で前回のデータが残っている | ユーザー | 未検証 |
| 1-6 | 端末再起動後もデータが残ることを確認する | iPhone 再起動 → 本体起動 → 読取で前回のデータが残っている | ユーザー | 未検証 |
| 1-7 | MUST-1 の go/no-go を判定し、結果を記録する | 全件通過なら go。1つでも NG なら no-go を記録し以降中止 | ユーザー + Claude | 暫定 go（単発の受け渡しは成立。多重到達・再起動耐性は未検証） |

---

## 段階2：最小縦割り（AC-2）

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 2-1 | 認可（`.individual`）の取得UIを実装する | `AuthorizationCenter.requestAuthorization(for: .individual)` が成功する | Claude + ユーザー | 完了 |
| 2-2 | FamilyActivityPicker で対象アプリを1つ選択できるようにする | 選択画面が表示され、選んだ `FamilyActivitySelection` を保存できる | Claude + ユーザー | 完了 |
| 2-3 | 選んだ対象の名前を `Label(token)` で画面に表示する | 選択したアプリ名が本体画面に表示される | Claude + ユーザー | 完了（選択数表示で代替。Label 表示は本実装で精緻化） |
| 2-4 | DeviceActivityEvent を1つ登録し `startMonitoring` する | 15分閾値の監視が開始される | Claude + ユーザー | 完了（15/30/60/120分の4閾値を登録） |
| 2-5 | `eventDidReachThreshold` で到達通知をログ出力する | 対象アプリを15分以上使うと拡張のログに出力される | ユーザー | 完了（Console.app で `reached its threshold` を確認） |
| 2-6 | 到達→App Group 書込→本体読取→画面表示の一気通貫を確認する | 許可取り→選択→監視→到達→表示が1サブスク・1アプリで通る | ユーザー | 完了 |

---

## 段階3：復旧・許可失効（MUST-2, MUST-8）

> 実機手順・記録テンプレ → `field-test-guide.md` 段階3

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 3-1 | iPhone 再起動後の監視状態を確認し、再アームで復旧する | 再起動→状態確認→`startMonitoring` で当日値を壊さず復旧 | ユーザー | 未着手 |
| 3-2 | アプリ kill 後の監視状態を確認する | 拡張は独立プロセスなので本体 kill では止まらないことを確認 | ユーザー | 未着手 |
| 3-3 | 許可を設定から取り消し、検知→再許可→再対応づけの導線を確認する | 取消検知→再認可→Picker で再選択→既存サブスクとの紐付けが復旧 | ユーザー | 未着手 |
| 3-4 | MUST-2, MUST-8 の結果を記録する | OK/NG と再現手順を記録 | ユーザー + Claude | 未着手 |

---

## 段階4：測定精度・日付境界（MUST-3, MUST-4, MUST-5）

> 実機手順・記録テンプレ → `field-test-guide.md` 段階4（4-1 三点照合は7日かかるので最初に開始）

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 4-1 | 三点照合を7日間実施する（0/16/31/61/121分の Controlled use） | 日ごとに手計測・Screen Time 表示・通知ログを記録した照合表が完成 | ユーザー | 未着手 |
| 4-2 | 有効7日中6日以上が1段階以内であることを確認する | 照合表で基準を満たす。境目のズレは理由を記録 | ユーザー + Claude | 未着手 |
| 4-3 | 日跨ぎ直前直後の利用で日付が正しく入ることを確認する | 23:50〜0:10 の利用が iPhone 現地日付で正しい日に入る | ユーザー | 未着手 |
| 4-4 | 二重通知・順不同でも段階が下がらないことを確認する | 端末側は単調更新、DB 側は段階が下がらない・重複行なし | ユーザー | 未着手 |
| 4-5 | 「利用ゼロの日（none）」「未同期で欠けた日（missing）」「監視停止」を技術的に判別できるか確認する | 3状態の判別方法が確定し、記録される | ユーザー + Claude | 未着手 |
| 4-6 | MUST-3, MUST-4, MUST-5 の結果を記録する | OK/NG と再現手順を記録 | ユーザー + Claude | 未着手 |

---

## 段階5：スケール限界試験（MUST-6）

> 実機手順・記録テンプレ → `field-test-guide.md` 段階5（ローカルファーストでは優先度↓・合否でなく安全上限の実測）

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 5-1 | 監視対象を段階的に増やす（5→10→20 サブスク × 4 閾値） | 各段階で `startMonitoring` がエラーにならないことを確認 | ユーザー | 未着手 |
| 5-2 | 密集到達でも取りこぼし・App Group の競合が起きないことを確認する | 複数対象の同時到達でデータが欠けない | ユーザー | 未着手 |
| 5-3 | MVP で安全に扱える対象数の上限を実測で決定する | 上限値（暫定 3〜5 件 or それ以上）が根拠付きで確定 | ユーザー + Claude | 未着手 |
| 5-4 | MUST-6 の結果を記録する | OK/NG と上限値を記録 | ユーザー + Claude | 未着手 |

---

## 段階6：同期堅牢性（MUST-7, AC-3）

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 6-1 | 本体から `POST /api/usage/daily` への送信を実装する | App Group のデータから `usageDailyBatchSchema` の JSON を生成し送信 | Claude（設計）+ ユーザー（実装） | 完了 |
| 6-2 | ネットワーク不通時に未送信を貯め、復旧後に再送することを確認する | 不通→復旧→再送で全件が Mac の DB に保存される | ユーザー | 未検証 |
| 6-3 | Mac 停止→再起動を挟んでも帳尻が合うことを確認する | Mac 停止中の送信は失敗→Mac 復旧後の再送で保存される | ユーザー | 未検証 |
| 6-4 | 冪等保存（同じデータを2回送っても重複しない）を確認する | `(subscriptionId, usageDate)` で upsert。段階は下がらない | ユーザー | 完了（同一データを複数回送信し行が増えず m120_plus を維持） |
| 6-5 | MUST-7, AC-3 の結果を記録する | OK/NG と再現手順を記録 | ユーザー + Claude | 完了（AC-3 達成。再送・Mac停止耐性は未検証） |

---

## 段階7：配布見込み（MUST-9）

> 方針メモ（2026-06-16）：**まずローカルファーストで構築する**。自分の iPhone で動かすだけなら
> 開発用の許可（自分で付けられる）で足り、配布用の申請・プライバシー申告は**不要**。
> 本段階の成果（`stage7-distribution-guide.md`）は「将来、他人に配る場合」のための備えであり、当面の MVP では作業は発生しない。

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 7-1 | entitlement 申請用の用途説明文を草案する | Family Controls を「節約」用途で使う説明が Apple の要件と矛盾しない | Claude + ユーザー | 完了（`stage7-distribution-guide.md` 手順A。記入方針＋英文ドラフト。Bundle ID ごと2件申請を確認） |
| 7-2 | `PrivacyInfo.xcprivacy` の草案を作成する | 使用する API・集める情報・送る情報を正しく申告した草案がある | Claude + ユーザー | 完了（同 手順B。Xcode 追加手順＋本体／拡張の XML。必須申告は UserDefaults `CA92.1` のみと実コードで確認） |
| 7-3 | App Store プライバシー表示の草案を整理する | 「収集するデータ」「リンクしないデータ」の分類が矛盾なく整理されている | Claude + ユーザー | 完了（同 手順C。App Store Connect 操作手順＋分類。使用状況データ＝本人に紐づく・追跡なし・用途はアプリ機能） |
| 7-4 | MUST-9 の結果（配布見込みの有無）を記録する | 見込みあり/なしを根拠付きで記録 | ユーザー + Claude | 完了（**配布見込みあり＝go 寄り**。個人利用アプリの配布許可取得の前例を確認。最終承認は配布時の実申請で確定） |

---

## 総合判定

| # | タスク | 完了条件 | 担当 | 状態 |
|---|---|---|---|---|
| 8-1 | MUST 1〜9 の結果を集約し、go/no-go を総合判定する | 全 MUST が OK なら go。1つでも NG なら no-go。判定表を本ステアリングに記録 | ユーザー + Claude | 部分完了（MUST-1/AC-2/AC-3＝実機で暫定 go、MUST-9＝机上で見込みあり。残る MUST-1残項目/2/3/4/5/6/7残項目は実機で要検証。下記「実機検証メモ」参照） |
| 8-2 | MVP 確定スコープを記録する（対象数上限・バケット下限・送信方式・日付基準） | go の場合のスコープが確定し、docs/ 追記候補が整理されている | Claude | 草案完了（`mvp-scope-draft.md`。ローカルファースト前提でスコープ・データ契約・docs追記候補を整理。実機依存値はTBD。go 確定後に確定版へ） |
| 8-3 | no-go の場合の P1 見送り方針を記録する | no-go の場合の代替方式（P2〜P6 のみ運用＋Shortcuts）と判断根拠が整理されている | Claude | 未着手 |

---

## 実機検証メモ（2026-06-14 実施）

### 検証環境

- iPhone 実機（iOS 16+）／Mac（Xcode）／Apple Developer Program（有料）
- App Group：`group.com.subbuddy.SubBuddySpike`（本体・拡張で共有）
- Bundle：`com.subbuddy.SubBuddySpike` ／ 拡張：`...MonitorExtension`
- Mac 側 SubBuddy は devcontainer 内で稼働。iPhone からの到達は VS Code の
  `remote.localPortHost: allInterfaces` で Mac の `0.0.0.0:3000` に公開して実現
  （iPhone → `http://<MacのLAN IP>:3000`）。

### 実証できたこと（暫定 go の根拠）

| 検証 | 結果・証跡 |
|---|---|
| MUST-1：拡張 → App Group → 本体読取 | ○ 本体で「レコード数1」を確認 |
| AC-2：最小縦割り（認可→選択→監視→到達→読取→表示） | ○ 一気通貫で成立 |
| 閾値到達 | ○ Console.app で `UsageTrackingAgent ... reached its threshold` を確認 |
| AC-3：`POST /api/usage/daily` → Mac DB に冪等 upsert | ○ `ios_usage_daily_summaries` に `Netflix / 2026-06-14 / m120_plus / estimated_minutes_min=120 / source=ios_device_activity` が着弾。`USAGE_SYNC_TOKEN` の Bearer 認証も通過 |

### つまづき・是正した落とし穴（本実装で先回りすべき点）

1. **Monitor 拡張のクラス名は Info.plist の `NSExtensionPrincipalClass` と一致必須**。
   不一致だと `Failed to notify ... ExtensionError Code=0` が出て拡張が起動しない。
2. **App Group / Family Controls は本体と拡張の「両ターゲット」に設定**。Shared コードは
   両ターゲットの Target Membership に入れる（漏れると `Cannot find ... in scope`）。
3. **拡張のログは `print` では Console に出ない**。`os.Logger` を使う。
4. **App Group コンテナ取得・`UserDefaults(suiteName:)` の force unwrap は禁止**（nil で
   クラッシュ）。Optional 化してフェイルセーフに。
5. **`DeviceActivityEvent(includesPastActivity: true)`** にしないと監視開始前の利用が
   閾値にカウントされず、検証が始められない。
6. **送信先 IP に `127.0.0.1` は不可**（iPhone 自身を指す）。Mac の LAN IP ＋
   `allInterfaces` 公開、`http`（自己署名 https は ATS で失敗）。ATS 例外も設定。
7. **サブスク ID は「送信先 DB に実在する ID」でなければ FK 制約で 500**。DB 再シード等で
   ID が変わる点に注意。
8. **着弾確認は `created_at` で絞らない**。冪等 upsert は既存行を update するため
   `created_at` は変わらない。`usage_date` と `estimated_minutes_min`（iOS 由来は値あり、
   seed は空）で判別する。

### 暫定判定

- **配管（MUST-1）と同期（AC-3）は成立 → 最大の不確実性は解消。暫定 go。**
- 未検証で残る MUST（多重到達・再起動耐性 MUST-1 残項目／復旧 MUST-2／測定精度 MUST-3／
  日付境界 MUST-4／二重通知 MUST-5／スケール MUST-6／再送 MUST-7 残項目／配布 MUST-9）は
  段階3〜7 として継続。**最終 go/no-go はこれらを満たしてから確定する。**
