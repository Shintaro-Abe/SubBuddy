# iCloud+ 容量の「取得方式」調査・戦略（実装なし）

> 調査日：2026-06-21 / 対象スコープ：iCloud+（容量ベース判定）の容量・プラン・使用量の取得方式 /
> 起用ペルソナ：iOS・Swift エンジニア ＋ テックリード／アーキテクト ＋ プライバシーエンジニア /
> codex 反証：実施（`codex:rescue`） /
> 方針：本書は調査・戦略立案のみ。コード実装・コミットは行っていない。

---

## 1. 調査サマリ（結論）

**ユーザーの iCloud アカウント全体の容量（契約プラン容量・使用容量・無料枠 5GB との差分）を、プログラムから取得できる「公開的・正規の手段」は存在しない。** 出典付き調査（Apple 公式ドキュメント中心・主要主張すべて high confidence）で確定した。したがって取得方式は次のとおりとする。

- **主：手動入力**（プラン容量・使用容量を画面で入力）。PRD 6.3 の「容量・プランは変動頻度が低い設定値のため手入力を許容」と整合。
- **補助1：スクリーンショット OCR**（設定 > iCloud のバーグラフ、または icloud.com/storage の画像）。オンデバイス OCR で**候補値を抽出 → ユーザー確認 → 保存**の3ステップに限定（自動確定はしない）。フェーズ2。
- **補助2：請求メール逆引き**（`billing-email` Adapter）。請求金額から**プラン容量**を逆引きできる（使用容量は取れない）。
- **不採用：非正規スクレイピング**（pyicloud 等）。Apple ID 資格情報＋2FA で iCloud.com の private エンドポイントを叩く方式で、ToS／アカウント BAN リスク、認証変更（SRP-6a）で保守不能。本プロジェクトの「資格情報を扱わない・ローカルファースト・PII 非保持」方針とも矛盾するため採らない。

**設計の中心軸（codex 反証の最重要指摘）**：自動取得できない以上、判定精度は「取得手段」より **データの信頼度（ユーザー確認済みか）・鮮度（いつの値か）・スコープ（個人か家族全体か）** に強く依存する。この3軸をデータモデルと判定の中心に据える。

---

## 2. 外部仕様・先行事例（出典付き）  ← Step1（deep-research）

検証した主張はいずれも Apple 一次情報で 3-0 confirmed（high confidence）。

### 2.1 公開 API では取得不可（主張1：確定）
- **Foundation の `volumeAvailableCapacity*` 系キー**（`volumeAvailableCapacityKey` / `…ForImportantUsageKey` / `…ForOpportunisticUsageKey`）は、**端末ローカルのファイルシステム容量**を測るもので、iCloud アカウント容量ではない。用途は「ローカル保存前の空き確認」。
- **CloudKit / `CKContainer`** は「自アプリのデータベースへの導管」で、容量・使用量・quota プロパティを持たない。`CKAccountStatus` はサインイン可否（available / noAccount / restricted …）のみ。
- ユーザーの iCloud quota は **`CKError.Code.quotaExceeded`**（保存失敗時のエラー）でしか間接的に分からない。「残り何 GB」を**事前に読み取るクエリは存在しない**。private データベースの中身自体も開発者は読めない。
- **CloudKit Web Services** も全リクエストが単一アプリコンテナ（`iCloud.` 始まり）にスコープされ、アカウント全体の容量エンドポイントは無い。

### 2.2 公開 Web API も無い（主張2：確定）
- Apple 公式の確認手段は **GUI 目視のみ**：`icloud.com/storage` にサインイン、または 設定 > [名前] > iCloud のバーグラフ／「アカウントのストレージを管理」。クロスプラットフォーム（iPhone/iPad/Mac/Windows）のサポート文書も UI 操作のみ記載。
- Apple Developer Forums で「ユーザーの iCloud 残容量をプログラムから確認する方法は？」という質問（thread 116785）に対し、**Apple 公式の API 回答は付いていない**。

### 2.3 サードパーティの自動取得は非正規のみ（主張3：確定）
- 唯一アカウント全体の使用量を読めるのは **pyicloud の `account.storage`**（`85.12% used of 53687091200 bytes` 等を返す）だが、これは **Apple ID 資格情報＋2FA で iCloud.com セッションを偽装**する**非正規・リバースエンジニアリング**手段。公開 API ではない。2024–2025 の **SRP-6a 認証変更で破綻気味**（Home Assistant #128830 ほか）、ToS／BAN リスクあり。

### 2.4 補助手段の妥当性
- **請求金額 → プラン逆引き（確定）**：US は固定価格（50GB \$0.99 / 200GB \$2.99 / 2TB \$9.99 / 6TB \$29.99 / 12TB \$59.99）。金額から**プラン容量**は分かるが**使用容量は不明**。**注意：一部地域は税込みで金額がずれる・通貨/階層が国により異なる**ため、厳密な金額一致は不安定。
- **StoreKit（推論・medium）**：StoreKit は**自アプリのサブスクのみ**取得でき、Apple システムサブスクである iCloud+ は取得できない見込み。直接検証した確定主張は無いため medium。

### 出典（主要）
- Foundation: https://developer.apple.com/documentation/foundation/urlresourcekey/volumeavailablecapacitykey ／ https://developer.apple.com/documentation/foundation/nsurlresourcekey/checking_volume_storage_capacity
- CloudKit: https://developer.apple.com/documentation/cloudkit/ckcontainer ／ https://developer.apple.com/documentation/cloudkit/ckcontainer/accountstatus(completionhandler:) ／ https://developer.apple.com/documentation/cloudkit/ckerror/code/quotaexceeded ／ https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html
- iCloud 容量確認（公式・GUI のみ）: https://support.apple.com/guide/icloud/check-your-icloud-storage-online-mm6e5a441fc7/icloud ／ https://support.apple.com/guide/icloud/check-your-icloud-storage-on-any-device-mm039c13d410/icloud
- iCloud+ 価格: https://support.apple.com/en-us/108047
- 非正規手段の実態: https://pypi.org/project/pyicloud/ ／ Apple Dev Forums https://forums.developer.apple.com/forums/thread/116785

---

## 3. 既存コードの規約・類似実装  ← Step2（Explore）

- **`UsageType="capacity"` は既に存在**：`apps/web/src/schemas/subscription.ts`（13–20 行）、`apps/web/prisma/schema.prisma`（85 行）、`apps/web/src/domain/scoring/computeRecommendation.ts`（16–22, 159–161 行。P1 は `capacity` には適用しない分岐済み）。
- **未実装**：容量データ格納フィールド／テーブル、容量判定パターン、`/api/icloud-plus`、容量入力 UI。`functional-design.md` 491 行に「iCloud+ 管理＝容量・プラン入力、容量ベース判定」と要件のみ。
- **取込はコネクタ（Adapter）パターン**：コネクタ名＝取得源（`icloud`/`screen-time`/`gym-visit`/`billing-email`）、軸名＝`time`/`capacity`/`visit`（別概念。`development-guidelines.md` 61 行 / `repository-structure.md` 207 行）。`UsageSource` は glossary に概念のみで DB 未反映。
- **取込フロー規約**：境界（Route Handler）で Zod 検証 → `domain/` の純粋関数 normalize → リポジトリで冪等 upsert（例：`apps/web/src/app/api/usage/daily/route.ts`、`apps/web/src/domain/usage/normalize.ts`、`apps/web/src/repositories/usage.ts`。キーは `subscription_id × usage_date`）。原本は入口で捨てず正規化は遅延実行。
- **しきい値は config 外出し**：`apps/web/src/config/scoring.ts`（Zod 検証・テストで差し替え可能。`minObservationDays` / `renewalSoonDays` / `highCostThreshold` 等）。容量閾値もここに追加する。
- **スコアリング**：パターン判定 P1〜P6（時間軸）。`matchedPatterns.ts` は P1〜P6 のみ実装、P7 は設計のみ。`RecommendationInput`（40–59 行）は時間軸フィールドに特化し容量フィールドは無い。

---

## 4. 実装戦略（採用案）  ← Step3 ＋ Step4 反映

### 4.1 取得方式（確定）
1. **手動入力を主**：プラン容量・使用容量を入力。プラン容量は **5GB/50GB/200GB/2TB/6TB/12TB の選択式**、使用容量は数値入力にして入力コストを下げる。
2. **無料枠 5GB は定数**としてコードで保持し、**ユーザー入力させない**（誤入力源を断つ。codex 指摘）。
3. **スクリーンショット OCR は補助・フェーズ2**：候補抽出 → **ユーザー確認必須** → 保存。OCR 値は未確認のまま判定に使わない。
4. **請求メール逆引きは補助**：`billing-email` Adapter で金額 → プラン容量を逆引き。使用容量は別途手入力。税込み・通貨差で曖昧な場合は確定させずユーザー確認に回す。
5. **非正規スクレイピングは不採用**（資格情報非保持・ローカルファースト・ToS/BAN・保守不能）。

### 4.2 データモデル（要修正：専用スナップショットテーブル）
- `Subscription` 直置きではなく **専用テーブル `CapacityUsageSnapshot` を新設**（契約属性と観測値を分離。Adapter 設計とも整合）。**時系列を残す**（誤入力修正・傾向判定・鮮度判定に効く。データ量は小さい）。
- カラム案（実装時に確定）：`subscriptionId` / `planCapacityGB` / `usedCapacityGB` / `capturedAt` / `source`（`manual`/`ocr`/`billing-email`）/ `confirmedByUser`（boolean）/ `usageScope`（`individual`/`familyTotal`）/ `costScope`（`individual`/`familyTotal`）/ `usedForBackup`。
- **`source` と `confirmedByUser` は分離**（取得源と確認状態は別概念。判定の重みに使う。codex 指摘）。
- 無料枠（5GB）はスナップショットに持たず定数。

### 4.3 判定（時間軸 P1〜P6 に影響させない・容量専用パターン）
- `UsageType==="capacity"` で分岐し、容量専用パターンを追加（既存 P1〜P6 は時間軸なので不変）。
- **「下位プランで足りるか」は単純比較にしない**。`usedCapacity + safetyBuffer < lowerPlanCapacity` とし、`safetyBuffer` は config 外出し（考え方：`max(5GB, lowerPlanCapacity × 10%)` 程度）。
- **鮮度を必須条件化**：`capturedAt` が古い／未確認なら判定せず「最新値の再確認が必要」を返す。
- **境界付近は判定保留**（下位プラン容量の近傍は自動候補化しない）。複数スナップショットがあれば増加傾向を見て、増加中は下位プラン判定を弱める。
- 提示は「ダウングレード推奨」ではなく**「容量余剰による見直し候補」**と軸を明示（中立表現・既存方針と整合）。

### 4.4 ファイル配置・整合（提案のみ。差分は書かない）
- 容量ロジック：`apps/web/src/domain/capacity/`（純粋関数 normalize）。API：`apps/web/src/app/api/icloud-plus/`。リポジトリ：`apps/web/src/repositories/` に容量メソッド追加。閾値：`apps/web/src/config/scoring.ts`。
- ドキュメント更新：`functional-design.md`（容量判定パターン・スナップショット）、`glossary.md`（capacity 軸の判定パターン・`usageScope`/`costScope`）、`repository-structure.md`（`domain/capacity/`）。

---

## 5. 却下した代替案とトレードオフ

| 代替案 | 却下理由 |
|---|---|
| 公開 API で自動取得 | **存在しない**（§2）。Foundation はローカル容量、CloudKit は自アプリ枠のみ。 |
| pyicloud 等の非正規スクレイピング | ToS/BAN、SRP-6a 破綻で保守不能、資格情報を扱う＝PII/ローカルファースト方針と矛盾。 |
| StoreKit で iCloud+ プラン取得 | 自アプリのサブスクのみ。Apple システムサブスクは取れない見込み（推論・medium）。 |
| 容量を `Subscription` に直置き | 契約属性と観測値が混在、履歴喪失、Adapter 設計と不整合（codex 指摘）。→ 専用スナップショット採用。 |
| `usedCapacity < 下位プラン` の単純比較 | 楽観的すぎる。変動・家族共有・鮮度で誤判定（codex 指摘）。→ バッファ＋鮮度＋保留。 |
| 家族共有を boolean のみ | 「本人分／家族全体」を混同し他メンバーを容量不足にし得る。→ `usageScope`/`costScope` 分離。 |

---

## 6. 反証で出た論点と対応  ← Step4（codex）

- **信頼度・鮮度・スコープを設計の中心に** → §1 / §4.2 に反映（中心軸として明記）。
- **専用スナップショットテーブル＋時系列** → §4.2 採用。
- **無料枠 5GB は定数化（入力させない）** → §4.1-2 反映。
- **OCR は候補→確認→保存の3段、自動確定禁止** → §4.1-3 反映。
- **「下位プランで足りるか」はバッファ＋鮮度＋傾向＋境界保留** → §4.3 反映。
- **家族共有は `usageScope`/`costScope` を分離、費用評価と容量評価は別概念** → §4.2 / §4.3 反映。
- **鮮度管理が品質の主戦場**（最終更新から N 日で再入力促し）→ §4.3 反映。

---

## 7. リスク・未確定事項・検証方針（後続作業への申し送り）

- **StoreKit で iCloud+ を取れないこと**は推論（medium）。実装着手前に StoreKit 2（`Transaction.currentEntitlements` / `AppTransaction`）で直接確認しておくと確実。
- **Shortcuts / App Intents** に iCloud 容量を出すアクションがあるかは今回コーパスで未確認（open question）。低確度だが念のため一次確認の余地。
- **OCR の堅牢性**：iCloud の UI 変更・言語・解像度に弱い。必ずユーザー確認を挟む前提で精度を実機検証（`verify`/`run` は本スキル外。後続で実施）。
- **請求逆引きの曖昧性**：税込み・通貨・国別階層差。金額一致が曖昧なときは確定させずユーザー確認に回す。
- **「絶対に API が無い」は不在証明**：今回検証した全公開面（Foundation/CloudKit/Web Services/サポート文書）では強く支持されるが、将来 API や未文書 API の不在までは論理的に証明できない。
- 検証方法：容量判定ロジックは config 差し替えのユニットテストで境界・鮮度・バッファを検証（既存 `config/scoring.test.ts` パターン）。

---

## 8. 参考リンク（出典一覧）
- https://developer.apple.com/documentation/foundation/urlresourcekey/volumeavailablecapacitykey
- https://developer.apple.com/documentation/foundation/nsurlresourcekey/checking_volume_storage_capacity
- https://developer.apple.com/documentation/cloudkit/ckcontainer
- https://developer.apple.com/documentation/cloudkit/ckcontainer/accountstatus(completionhandler:)
- https://developer.apple.com/documentation/cloudkit/ckerror/code/quotaexceeded
- https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html
- https://developer.apple.com/icloud/cloudkit/
- https://support.apple.com/guide/icloud/check-your-icloud-storage-online-mm6e5a441fc7/icloud
- https://support.apple.com/guide/icloud/check-your-icloud-storage-on-any-device-mm039c13d410/icloud
- https://support.apple.com/en-us/108047
- https://www.rambo.codes/posts/2020-02-25-cloudkit-101
- https://pypi.org/project/pyicloud/
- https://forums.developer.apple.com/forums/thread/116785
- https://developer.apple.com/forums/thread/125486
