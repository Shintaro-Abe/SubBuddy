# iOS Shortcut 起動シグナル連携 実装方法の調査・戦略（実装なし）

> 調査日：2026-06-19 / 対象スコープ：iOS Shortcuts の「App→Is Opened」オートメーションで、背景再生アプリの起動を検知し利用シグナル（used:true, source:ios_shortcut）を自宅MacのローカルAPIへ自動送信する実現方式 / 起用ペルソナ：AI開発オーケストレーター（Shortcuts自動化）＋ Next.js/Zod エンジニア / codex反証：実施
>
> 📖 読み方：専門用語は残しつつ、初出に「（＝平たい言い換え）」を添えています。

---

## 1. 調査サマリ（結論）

**判定：条件付き Go（実機検証ゲートあり）。**

- 「ユーザーが確認タップせず、無音でアプリ起動を検知して送信する」という**サイレント自動実行の仕組みは出典で裏が取れた**（iOS 14+ で確認OFF、15.4+ で通知バナー抑止、17+ で Run Immediately）。
- **Web 受信側はスキーマ変更不要**。`used:true` を送れば P1（＝使っていない判定）の「最後に使った日（daysSinceLastUse）」が更新される。`usageBucket` は分の総和にしか効かないので `none`（＝0分／時間不明）で送ればよい。
- ただし2つの本質的な限界がある：
  1. **未確証**：ローカルIP宛てのプレーンHTTP POST が Shortcuts から実際に通るかは出典で断定できず、**実機検証が必須ゲート**。
  2. **意味の限界（codex反証の最重要指摘）**：`App→Is Opened` は「前面でアプリを実際に開いた時」しか発火しない。背景再生（ロック画面・CarPlay のみの音楽再生など）では発火しない。
- したがってこの信号は **「利用計測」ではなく「前面起動の検知」**。**「検知あり＝最近触った」として recency 更新に使うのは妥当**だが、**「検知なし＝使っていない」と断定して解約候補に直結させる設計は No-go**。

---

## 2. 外部仕様・先行事例（出典付き）  ← Step 1（deep-research：17ソース→58主張→15確証/10棄却）

### 2.1 サイレント自動実行（確認タップなし）— 成立
- iOS 14+：個人オートメーションの「Ask Before Running（実行前に尋ねる）」を OFF にすると確認なしで自動実行できる。 — macmost.com（vote 2-1 確証）
- iOS 17+：トリガに「Run Immediately（すぐ実行）」オプションが追加され、従来の「Run After Confirmation」タップが不要に。 — matthewcassinelli.com（2-1 確証）
- 「App」トリガは対象アプリの "Is Opened" / "Is Closed" で発火。アプリと条件を選んで設定する。 — howtogeek.com（3-0 確証）
- アプリ起動オートメーションは、アプリを使い始めた/終えた時の追跡用途で「最も恩恵が大きい」と名指しされている。 — imore.com（3-0 確証）

### 2.2 通知バナーの抑止 — 成立（ただしサマリ通知は別途）
- iOS 15.4（2022-03-14）で「Running your automation」バナーを出さない公式設定が追加。 — gadgethacks / macrumors / imore（3-0 確証）
- 「Notify When Run（実行時に通知）」トグルは "Ask Before Running" を OFF にして初めて出現し、OFF で実行通知を抑止できる。 — gadgethacks（3-0）/ macrumors（2-1）
- ただし **通知を切っても iOS は定期サマリ通知を送る**（これも別途 OFF 可能）。 — imore.com（3-0 確証）

### 2.3 棄却された主張（＝今回に有利な反証）
- 「Run Immediately だと必ず通知が出て無音にできない」→ **0-3 棄却**。
- 「自動実行でも必ずバナーが出る」→ **0-3 棄却**。
- 「iOS 18.2 で自動実行が毎回確認を求める回帰が起きた」→ **0-3 棄却**。
- iOS 18 のロック中制限・背景アプリ不発などの主張は多くが 1-2 で弱い（確証されず）。なお App 起動オートメーションは「アプリを前面で開く＝端末を能動操作中」が前提なので、ロック画面起因の不安は本用途では大半が無関係。

### 2.4 確証が取れなかった論点（要実機検証）
- **ローカルIP宛てプレーンHTTP POST**：`Get Contents of URL` が POST・JSON Body・ヘッダを送れること自体は公式仕様。だが「`http://<LAN IP>:3000/...` が Shortcuts から実際に通るか（ATS非適用・ローカルネットワーク許可・ファイアウォール）」を裏付ける一次情報は得られなかった。technical 角度は「1 novel（5 filtered）」で確証クレーム0。→ §7 の必須ゲート。

---

## 3. 既存コードの規約・類似実装  ← Step 2（read-only）

- 受信契約：`apps/web/src/schemas/usage.ts:14-37`。`usageDailyItemSchema` は `subscriptionId / date(YYYY-MM-DD) / used(bool) / usageBucket(enum・必須) / estimatedMinutesMin?/Max? / source(enum default ios_device_activity)`。`source` enum に `ios_shortcut` は**既に定義済み**（同 :22）。
- バケット定義：`apps/web/src/lib/usage-bucket.ts:8-9,48`。`none` はワイヤ値として存在し下限分数 **0** にマップ。
- 整形：`apps/web/src/domain/usage/normalize.ts`。`date` を UTC 0時の Date に固定、`source` をそのまま保持。
- 集計：`apps/web/src/domain/usage/aggregate.ts:55-68`。`daysSinceLastUse`・`usageDays30d` は **`used:true` の日**から導出。`usageBucket` は `usageMinutes30d`（分の総和）にのみ寄与。→ **起動シグナル（used:true, bucket:none）で recency は正しく更新、分は 0 加算**。
- 判定：`apps/web/src/domain/scoring/computeRecommendation.ts:159-219`。P1 は `canApplyP1(usageType)` と `hasUsageData` と `daysSinceLastUse` で判定。**source も回数も参照していない**。
- 認証：`apps/web/src/lib/usage-auth.ts`。`USAGE_SYNC_TOKEN` の Bearer 検証（timingSafeEqual・未設定はフェイルクローズ）。
- 保存：Prisma `IosUsageDailySummary`（`apps/web/prisma/schema.prisma:121-141`）。`@@unique([subscriptionId, usageDate])` で冪等 upsert。**count 列は存在しない**（時間バケット方式のみ）。
- しきい値外出し：`apps/web/src/config/scoring.ts`（方針整合）。

---

## 4. 実装戦略（採用案）  ← Step 3

> ユーザー決定（2026-06-19）：データモデルは「利用シグナルだけで十分（回数は取り込まない・スキーマ変更なし）」、検証の主眼は「実機で Shortcut が発火するか」。

### 4.1 iPhone 側（ユーザーが実機で構築）
1. Shortcuts の個人オートメーション「App → 対象アプリ → Is Opened」を作成。
2. アクション `Get Contents of URL`：
   - URL `http://<MacのLAN IP>:3000/api/usage/daily`、Method `POST`
   - Header `Authorization: Bearer <USAGE_SYNC_TOKEN>`、`Content-Type: application/json`
   - Body（JSON）：`{"items":[{"subscriptionId":"<固定UUID>","date":"<端末ローカル日付 yyyy-MM-dd>","used":true,"usageBucket":"none","source":"ios_shortcut"}]}`
   - `date` は Shortcuts の「現在の日付」を端末ローカルTZで `yyyy-MM-dd` 整形（Mac で再解釈しない）。
3. サイレント化：iOS 15.4+ で「Ask Before Running」OFF＋「Notify When Run」OFF。iOS 17+ は「Run Immediately」。サマリ通知も別途 OFF。

### 4.2 Web 側（Claude が担当・コードは別ステアリングで）
- **スキーマ変更なし**。起動シグナルの**正規形**を「`used:true` + `usageBucket:"none"` + `source:"ios_shortcut"`」と定義し、**テストで固定**（受信→normalize→保存→aggregate で `daysSinceLastUse` が更新されることを assert）。
- 同日複数起動は `(subscriptionId, usageDate)` 冪等 upsert で「1日1件の used」に収束（過大計上しない）。
- **意味づけの明文化（codex反証反映・必須）**：`source=ios_shortcut && usageBucket=none` を「**起動検知のみ・時間不明・弱い陽性シグナル**」として docs に定義。集計表示で「使った日はあるが0分」が出ても仕様どおりと注記。

### 4.3 P1 判定での扱い（codex反証反映）
- 検知あり → `daysSinceLastUse` を更新し「最近触った」とみなす（recency 補助として採用）。
- **検知なし → 「使っていない」と断定しない**。背景再生型（音楽・動画）はこの信号で取りこぼすため、シグナル欠如を解約候補の強い根拠にしない（カテゴリ／`usage_type` で重み調整 or 注意表示）。

---

## 5. 却下した代替案とトレードオフ  ← Step 3 / 4

| 代替案 | 却下/保留理由 |
|---|---|
| 回数（count）列を新設し頻度を判定に使う | ユーザー判断で不採用。現エンジンは頻度を消費せず「箱だけ作って使わない」状態になる。recency で P1 は足りる |
| DeviceActivity ネイティブアプリ方式 | 最も高精度だが専用アプリ・許可・App Group/Extension が必要で「軽量追加」として重い。別系統（iOS Spike）で継続 |
| ルーター/DNS のネットワーク観測 | 自動だが意味精度が低く保守が重い |
| 手動/ウィジェット/共有シート入力 | 確実だがユーザー負担。日々の手間を嫌う方針に反する |
| LAN を HTTPS 化／Tailscale 経由 | 平文 Bearer の強化策としては有効だが、ローカルファースト最小構成では過剰。必要なら後続で検討 |

---

## 6. 反証で出た論点と対応  ← Step 4（codex:rescue、判定＝条件付きGo）

- **A. 意味的限界（重大）**：`Is Opened` は前面起動のみ発火。背景再生で false negative。→ 戦略 4.3 に反映（検知なしを未使用と断定しない）。
- **B. ローカルHTTP（重大・ただしATS観点では致命的でない見込み）**：ATS は IP/未修飾ホスト/`.local` に保護を提供しない＝LAN IP宛てHTTPを直ちに否定はしない。だが「Shortcuts から必ず通る」は別問題。ローカルネットワーク許可・Mac の bind 先（localhost のみになっていないか）・ファイアウォール・Wi-Fi クライアント分離を実機確認。平文 Bearer は家庭LAN限定なら許容、強化は Tailscale/HTTPS。→ §7 ゲート。
- **C. used:true + none の副作用（P1 軽微・集計/他判定は要注意）**：P1 は無害。だが「利用日は増えるが分は増えない」データになり、`usageMinutes>0` を条件にする判定があれば無視される。→ 「none=時間不明」を明文化（戦略 4.2）。
- **D. 代替（問題なし）**：Shortcuts は低コスト自動シグナルとしては有力。ただし確実な計測ではない。→ §5。
- **E. P1 妥当性（重大）**：positive-only。誤タップ等で false positive も。意味は「利用」でなく「起動」。→ recency の補助証拠に限定（戦略 4.3）。

---

## 7. リスク・未確定事項・検証方針（後続への申し送り）

### 7.1 必須の実機検証ゲート（ユーザーが Mac/iPhone で実施。Claude は実行不可）
1. **【最優先】ローカルHTTP POST 到達**：iPhone Shortcuts から `http://<Mac LAN IP>:3000/api/usage/daily` に POST が通り、201/200 が返るか。初回のローカルネットワーク許可ダイアログ挙動、`Authorization` ヘッダが送られるか。
2. **Mac の bind 先**：dev server が `localhost` のみでなく LAN(0.0.0.0) で待受しているか。ファイアウォール許可。
3. **無音発火**：対象アプリ起動でオートメーションが確認なし・バナーなしで発火するか（サマリ通知 OFF 含む）。
4. **日付境界**：端末ローカル日付で `date` が入り、日跨ぎで別日にならないか。

### 7.2 Claude がこの環境で検証可能（後続ステアリングのコード作業）
- 起動シグナル正規形の受信→保存→`daysSinceLastUse` 更新のユニットテスト。
- 同日複数起動の冪等性テスト。

### 7.3 未確定
- iOS 18/26 系のオートメーション安定性（逸話レベル・要実機）。
- 背景再生取りこぼしの製品的許容ライン（PM 判断）。

### 7.4 次アクション
- 実機ゲート（§7.1）が Go なら、root `.steering/[YYYYMMDD]-ios-shortcut-launch-signal/` を requirements→design→tasklist の承認ゲートで正式に起こし、§4.2 のコード固定＋実機手順書（field-test-guide）を作成。
- **本スキルは調査・戦略立案のみ。コード実装・コミットは行っていない。**

---

## 8. 参考リンク（出典一覧）
- Run Immediately / 通知：https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications/
- 通知バナー抑止（iOS15.4）：https://ios.gadgethacks.com/how-to/prevent-running-your-automation-notifications-for-shortcuts-your-iphone-ios-15-4-0384968/
- Notify When Run トグル：https://www.macrumors.com/how-to/turn-off-notifications-automations-shortcuts/ ／ https://www.imore.com/shortcuts-beta-adds-notify-when-run-toggle-hide-automations-summary-view
- App トリガ / Run Immediately：https://www.howtogeek.com/useful-ways-to-trigger-automations-on-your-iphone/
- iOS14 自動実行：https://macmost.com/run-personal-automation-shortcuts-automatically-in-ios-14.html
- 通知なし実行手順：https://www.idownloadblog.com/2022/02/01/run-shortcuts-automations-without-notifications-tutorial/
- Get Contents of URL の JSON Body：https://blog.alexwendland.com/2020-07-01-custom-json-payload-for-get-contents-of-url-in-ios-shortcuts/
- ロック中実行の挙動議論：https://talk.automators.fm/t/why-do-some-time-triggered-shortcuts-run-on-a-locked-iphone-and-others-fail/18608
