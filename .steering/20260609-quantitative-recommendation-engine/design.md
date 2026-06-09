# 定量レコメンドエンジンの実装：設計

> ステアリング：`.steering/20260609-quantitative-recommendation-engine/`
> 作成日：2026-06-09
> 前提：`requirements.md`（承認済み）
> 📖 専門用語は残し、初出に「（＝平たい言い換え）」を添える。

---

## 1. 実装アプローチ

既存の `computeRecommendation`（純関数）を**パターン判定方式に置き換える**。

| 現行 | 変更後 |
|---|---|
| 未使用日数を中心とした単一スコアで判定 | P1〜P7 の具体的な状況パターンを個別に判定し、該当するものをすべて表示 |
| 全サブスクに同じ計算式を適用 | `usage_type` に応じてパターンの適用可否を切り替え |
| 理由文は判定後に1つ生成 | 該当した全パターンの根拠（evidence）を列挙 |

---

## 2. 変更するコンポーネント

| 既存コンポーネント | 変更内容 |
|---|---|
| `computeRecommendation.ts`（純関数） | 入力・出力の型を拡張し、パターン判定ロジックに書き換え |
| `config/scoring.ts`（しきい値外出し） | パターン判定用のしきい値に置き換え |
| `recompute.ts`（取りまとめ） | サービスカタログからの知識ベース取得・`usage_type` 解決を追加 |
| `reasons.ts`（理由文） | パターン別の理由文生成に書き換え |
| `prisma/schema.prisma` | ServiceCatalog の拡張、新規テーブル追加、Subscription に3フィールド追加 |
| `schemas/usage.ts` | `source` に `ios_shortcut` 追加 |
| `schemas/subscription.ts` | `matchedServiceId`, `usageType`, `initialValueAnswer` 追加 |
| 登録画面 | カタログ選択式 UI・初回1問 UI 追加 |
| 詳細画面 | パターン表示・節約額表示・QR コード表示 |
| レコメンド一覧画面 | パターンバッジ・根拠表示 |
| `computeRecommendation.test.ts` | パターン判定のテストに全面書き換え |
| `docs/product-requirements.md` | §1, §8.3, §8.5, §10.0, §10.1 の改訂 |
| `docs/functional-design.md` | §8 判定ルールの改訂 |

### 変更しないもの

| 対象 | 理由 |
|---|---|
| `Decision` enum（keep/review/consider_downgrade/consider_cancel/strong_cancel_candidate） | 既存5値をそのまま使い、パターンとの対応で吸収 |
| `DataStatus` enum（observing/ready） | 維持。観測中/確定の概念はそのまま |
| `/api/usage/daily`（API エンドポイント） | 既存の契約にそのまま適合。`source` の値追加のみ |
| `ios_usage_daily_summaries` テーブル | 既存のまま。Shortcuts データもここに格納 |

---

## 3. パターンと Decision enum の対応

| パターン | Decision | 表示名 |
|---|---|---|
| P1 使っていない（60日以上） | `strong_cancel_candidate` | 強い解約候補 |
| P1 使っていない（30日以上） | `consider_cancel` | 解約検討 |
| P2 重複で割高 | `consider_cancel` | 解約検討 |
| P4 安い競合がある | `consider_cancel` | 乗り換え検討 |
| P3 安いプランがある | `consider_downgrade` | ダウングレード検討 |
| P5 更新が近い | `review` | 更新前に見直し |
| P6 高額で長期継続 | `review` | 確認 |
| P7 該当なし | `keep` | 継続 |

複数パターンが該当する場合は、**最も強い Decision を採用**する。
強い順：`strong_cancel_candidate` > `consider_cancel` > `consider_downgrade` > `review` > `keep`

該当した**全パターンの根拠（evidence）**をレコメンドと一緒に表示する。

---

## 4. データモデルの変更

### 4.1 ServiceCatalog の拡張（既存テーブル）

`usage_type` フィールドを追加する。

```prisma
model ServiceCatalog {
  // ── 既存フィールド（変更なし） ──
  id              String   @id @default(cuid())
  canonicalName   String   @map("canonical_name")
  category        String
  domains         String?
  appBundleIds    String?  @map("app_bundle_ids")
  commonAliases   String?  @map("common_aliases")
  cancellationUrl String?  @map("cancellation_url")
  isSupported     Boolean  @default(true) @map("is_supported")
  isExcluded      Boolean  @default(false) @map("is_excluded")
  notes           String?

  // ── 追加 ──
  usageType       String   @default("active_foreground") @map("usage_type")
  // 値："active_foreground" | "active_background" | "active_other_device"
  //      | "passive" | "entitlement" | "capacity"

  plans           ServicePlan[]
  alternatives    ServiceAlternative[] @relation("from")

  @@map("service_catalog")
}
```

### 4.2 ServicePlan（新規テーブル）

同一サービスのプラン別料金を管理する。P3（安いプランがある）の判定に使用。

```prisma
model ServicePlan {
  id            String         @id @default(cuid())
  service       ServiceCatalog @relation(fields: [serviceId], references: [id])
  serviceId     String         @map("service_id")
  name          String         // 例："広告つきスタンダード"
  monthlyPrice  Int            @map("monthly_price") // 円
  isFreeTier    Boolean        @default(false) @map("is_free_tier")
  verifiedAt    DateTime       @map("verified_at")
  sourceUrl     String?        @map("source_url")

  @@map("service_plans")
}
```

### 4.3 ServiceAlternative（新規テーブル）

サービス間の代替関係を管理する。P4（安い競合がある）の判定に使用。

```prisma
model ServiceAlternative {
  id            String         @id @default(cuid())
  fromService   ServiceCatalog @relation("from", fields: [fromServiceId], references: [id])
  fromServiceId String         @map("from_service_id")
  toServiceId   String         @map("to_service_id")
  relation      String         @default("same_category")
  // 値："same_category"（同カテゴリ）| "partial_overlap"（部分重複）

  @@map("service_alternatives")
}
```

### 4.4 Subscription の拡張（既存テーブル）

カタログ紐付け・利用の性質・初回1問の回答を追加する。

```prisma
model Subscription {
  // ── 既存フィールド（変更なし） ──
  // ...

  // ── 追加 ──
  matchedServiceId   String?  @map("matched_service_id")
  // カタログから選択した場合に設定。null ならカタログ未登録

  usageType          String   @default("active_foreground") @map("usage_type")
  // カタログ選択時は自動設定。カタログ外はユーザーが選択

  initialValueAnswer String?  @map("initial_value_answer")
  // "very_important" | "somewhat" | "not_much" | null（未回答）
}
```

---

## 5. computeRecommendation の再設計

### 5.1 入力の型

```typescript
export interface RecommendationInput {
  // ── 既存（維持） ──
  amount: number;
  billingCycle: BillingCycle;
  importance: number;
  observationDays: number;
  daysUntilRenewal: number | null;
  hasCategoryOverlap: boolean;
  hasUsageData: boolean;

  // ── 追加 ──
  usageType: UsageType;
  usageDaysInSpan: number;             // 判定スパン内の利用日数（月額→30日、年額→365日）
  daysSinceLastUse: number | null;     // 最終利用からの経過日数
  judgmentSpanDays: number;            // 判定スパン（月額=30、年額=365）
  contractMonths: number;              // 登録日からの月数
  cumulativeSpend: number;             // 累計支払額（自動算出）
  cheaperPlan: CheaperOption | null;   // P3 用：同サービスの安い有料プラン
  cheaperAlternative: CheaperOption | null; // P4 用：同カテゴリの安い有料競合
  cheapestInCategory: number | null;   // P2 用：同カテゴリ内の最安月額
  initialValueAnswer: InitialValueAnswer | null;
}

type UsageType =
  | "active_foreground"
  | "active_background"
  | "active_other_device"
  | "passive"
  | "entitlement"
  | "capacity";

type InitialValueAnswer = "very_important" | "somewhat" | "not_much";

interface CheaperOption {
  name: string;
  monthlyPrice: number;
  verifiedAt: Date;
}
```

### 5.2 出力の型

```typescript
export interface RecommendationResult {
  decision: Decision;
  dataStatus: DataStatus;
  matchedPatterns: MatchedPattern[];   // 該当した全パターン
  annualSavingsIfCancelled: number;
  annualSavingsIfDowngraded: number | null;
  reason: string;                      // 全パターンを統合した理由文
  monthlyAmount: number;
  yearlyAmount: number;
  confidence: number;
}

interface MatchedPattern {
  pattern: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  label: string;      // "使っていない" | "重複で割高" | ...
  evidence: string;    // "30日間の前面利用がありません"
  caveat?: string;     // "TV/PCでの利用は計測外です"
}
```

### 5.3 判定ロジック

requirements.md §4 の判定条件をそのまま実装する。

```typescript
export function computeRecommendation(
  input: RecommendationInput,
  config: ScoringConfig,
): RecommendationResult {
  const patterns: MatchedPattern[] = [];
  const monthlyAmount = toMonthlyAmount(input.amount, input.billingCycle);
  const yearlyAmount = toYearlyAmount(input.amount, input.billingCycle);

  // ── P1：使っていない（方式C＝スパン内利用日数＋最終利用経過日数の両方で判定） ──
  if (
    (input.usageType === "active_foreground" || input.usageType === "active_background")
    && input.hasUsageData
  ) {
    const lastUseDays = input.daysSinceLastUse ?? input.observationDays;
    const spanDays = input.usageDaysInSpan;
    const caveat = input.usageType === "active_background"
      ? "背景再生は計測外です" : undefined;

    if (spanDays === 0 && lastUseDays >= 61) {
      // スパン内利用ゼロ＋最終利用61日以上 → 解約検討
      patterns.push({
        pattern: "P1",
        label: "使っていない",
        evidence: `最後に使ったのは${lastUseDays}日前です。直近${input.judgmentSpanDays}日間の利用が0日です`,
        caveat,
      });
    } else if (spanDays === 0 && lastUseDays >= 31) {
      // スパン内利用ゼロ＋最終利用31〜60日 → 様子見
      patterns.push({
        pattern: "P1",
        label: "使っていない",
        evidence: `最後に使ったのは${lastUseDays}日前です`,
        caveat,
      });
    } else if (spanDays >= 1 && lastUseDays >= 61) {
      // スパン内に利用あるが最終利用が古い → 様子見
      patterns.push({
        pattern: "P1",
        label: "使っていない",
        evidence: `直近${input.judgmentSpanDays}日間に利用がありますが、最後に使ったのは${lastUseDays}日前です`,
        caveat,
      });
    }
    // spanDays >= 1 && lastUseDays <= 30 → P1 非該当（使っている）
  }
  // active_other_device, passive, entitlement, capacity → P1 適用不可

  // ── P2：重複で割高 ──
  if (input.hasCategoryOverlap && input.cheapestInCategory !== null) {
    if (monthlyAmount > input.cheapestInCategory) {
      patterns.push({
        pattern: "P2",
        label: "重複で割高",
        evidence: `同カテゴリに¥${input.cheapestInCategory.toLocaleString()}/月のサービスがあります`,
      });
    }
  }

  // ── P3：安いプランがある ──
  if (input.cheaperPlan) {
    const saving = monthlyAmount - input.cheaperPlan.monthlyPrice;
    if (saving > 0) {
      patterns.push({
        pattern: "P3",
        label: "安いプランがある",
        evidence: `${input.cheaperPlan.name}（¥${input.cheaperPlan.monthlyPrice.toLocaleString()}/月）に変更できます`,
      });
    }
  }

  // ── P4：安い競合がある ──
  if (input.cheaperAlternative) {
    const saving = monthlyAmount - input.cheaperAlternative.monthlyPrice;
    if (saving > 0) {
      patterns.push({
        pattern: "P4",
        label: "安い競合がある",
        evidence: `${input.cheaperAlternative.name}（¥${input.cheaperAlternative.monthlyPrice.toLocaleString()}/月）があります`,
      });
    }
  }

  // ── P5：更新が近い ──
  if (
    input.billingCycle === "yearly" &&
    input.daysUntilRenewal !== null &&
    input.daysUntilRenewal <= config.renewalSoonDays
  ) {
    patterns.push({
      pattern: "P5",
      label: "更新が近い",
      evidence: `年額更新まで残り${input.daysUntilRenewal}日（更新額¥${yearlyAmount.toLocaleString()}）`,
    });
  }

  // ── P6：高額で長期継続 ──
  if (
    monthlyAmount >= config.highCostThreshold &&
    input.contractMonths >= config.longContractMonths
  ) {
    patterns.push({
      pattern: "P6",
      label: "高額で長期継続",
      evidence: `${input.contractMonths}ヶ月継続中（累計¥${input.cumulativeSpend.toLocaleString()}）`,
    });
  }

  // ── Decision 決定 ──
  const decision = determineDecision(patterns, input, config);
  const reason = buildReason(patterns);
  const annualSavingsDown = input.cheaperPlan
    ? (monthlyAmount - input.cheaperPlan.monthlyPrice) * 12
    : null;

  return {
    decision,
    dataStatus: input.observationDays >= config.minObservationDays
      ? DataStatus.ready
      : DataStatus.observing,
    matchedPatterns: patterns,
    annualSavingsIfCancelled: yearlyAmount,
    annualSavingsIfDowngraded: annualSavingsDown,
    reason,
    monthlyAmount,
    yearlyAmount,
    confidence: patterns.length > 0 ? 1.0 : 0.5,
  };
}
```

### 5.4 Decision 決定関数

```typescript
function determineDecision(
  patterns: MatchedPattern[],
  input: RecommendationInput,
  config: ScoringConfig,
): Decision {
  if (patterns.length === 0) return Decision.keep;

  const hasP1 = patterns.some((p) => p.pattern === "P1");
  const hasP2 = patterns.some((p) => p.pattern === "P2");
  const hasP4 = patterns.some((p) => p.pattern === "P4");
  const hasP3 = patterns.some((p) => p.pattern === "P3");

  // P1: スパン内利用0日＋最終利用61日以上 → strong_cancel_candidate
  //     それ以外の P1 該当（様子見パターン） → review
  if (hasP1) {
    const lastUseDays = input.daysSinceLastUse ?? input.observationDays;
    if (input.usageDaysInSpan === 0 && lastUseDays >= 61) {
      return Decision.strong_cancel_candidate;
    }
    return Decision.review;
  }

  if (hasP2 || hasP4) return Decision.consider_cancel;
  if (hasP3) return Decision.consider_downgrade;

  // P5 or P6 のみ
  return Decision.review;
}
```

---

## 6. config/scoring.ts の変更

```typescript
export const scoringConfigSchema = z.object({
  // ── 観測期間（既存・維持） ──
  minObservationDays: z.number().int().min(1).default(14),

  // ── P1：使っていない（方式C） ──
  // 判定スパンは billingCycle から自動決定（月額=30日、年額=365日）
  p1WatchLastUseDays: z.number().int().min(1).default(31),    // 最終利用からこの日数以上 → 様子見
  p1CancelLastUseDays: z.number().int().min(1).default(61),   // 最終利用からこの日数以上＋スパン内利用0日 → 解約検討

  // ── P5：更新が近い ──
  renewalSoonDays: z.number().int().min(1).default(7),

  // ── P6：高額で長期継続 ──
  highCostThreshold: z.number().int().min(0).default(2000),   // 月額¥2,000以上
  longContractMonths: z.number().int().min(1).default(12),    // 12ヶ月以上

  // ── 知識ベースの鮮度 ──
  knowledgeBaseStaleDays: z.number().int().min(1).default(180),       // 6ヶ月
  staleConfidenceMultiplier: z.number().min(0).max(1).default(0.7),  // 70%に低下
});
```

---

## 7. recompute.ts の変更

`recompute.ts` は `computeRecommendation` への入力を組み立てる取りまとめ層。以下の処理を追加する。

```typescript
async function buildRecommendationInput(
  subscription: Subscription,
  allSubscriptions: Subscription[],
): Promise<RecommendationInput> {
  // ── 既存の処理（維持） ──
  // amount, billingCycle, importance, observationDays, usageDays30d, etc.

  // ── 追加①：usage_type の解決 ──
  const usageType = subscription.usageType;

  // ── 追加②：契約期間・累計支払額 ──
  const contractMonths = diffMonths(subscription.createdAt, today);
  const cumulativeSpend = toMonthlyAmount(subscription.amount, subscription.billingCycle)
    * contractMonths;

  // ── 追加③：知識ベースからの取得（matched_service_id がある場合） ──
  let cheaperPlan: CheaperOption | null = null;
  let cheaperAlternative: CheaperOption | null = null;

  if (subscription.matchedServiceId) {
    const monthlyAmount = toMonthlyAmount(subscription.amount, subscription.billingCycle);

    // P3 用：同サービスの安い有料プラン
    const plans = await db.servicePlan.findMany({
      where: {
        serviceId: subscription.matchedServiceId,
        isFreeTier: false,
        monthlyPrice: { lt: monthlyAmount },
      },
      orderBy: { monthlyPrice: "asc" },
    });
    if (plans.length > 0) {
      const staleDays = diffDays(plans[0].verifiedAt, today);
      const confidence = staleDays > config.knowledgeBaseStaleDays
        ? config.staleConfidenceMultiplier : 1.0;
      cheaperPlan = {
        name: plans[0].name,
        monthlyPrice: Math.round(plans[0].monthlyPrice * confidence),
        verifiedAt: plans[0].verifiedAt,
      };
    }

    // P4 用：同カテゴリの安い有料競合
    const alternatives = await db.serviceAlternative.findMany({
      where: { fromServiceId: subscription.matchedServiceId },
    });
    // 代替サービスの最安有料プランを取得して比較
    // ...（省略：代替サービスの plans から最安を取得）
  }

  // ── 追加④：同カテゴリ内の最安月額（P2 用） ──
  const sameCategory = allSubscriptions.filter(
    (s) => s.category === subscription.category && s.id !== subscription.id,
  );
  const cheapestInCategory = sameCategory.length > 0
    ? Math.min(...sameCategory.map((s) => toMonthlyAmount(s.amount, s.billingCycle)))
    : null;

  return {
    // 既存フィールド + 追加フィールド
    usageType,
    contractMonths,
    cumulativeSpend,
    cheaperPlan,
    cheaperAlternative,
    cheapestInCategory,
    initialValueAnswer: subscription.initialValueAnswer,
    // ...既存フィールド
  };
}
```

---

## 8. サービスカタログの登録 UI

### 8.1 登録フロー

```
① ユーザーがサービス名を入力（テキストフィールド）
       ↓
② あいまい検索で ServiceCatalog を照合
   ├ 候補あり → ユーザーが選択
   │   → matchedServiceId, usageType, category が自動設定
   │   → 知識ベース（プラン・代替）が自動で利用可能に
   └ 候補なし → 「新しいサービスとして登録」を選択
       → ユーザーがカテゴリと usageType を選ぶ
       → matchedServiceId = null
       ↓
③ 料金・更新日を入力（既存フロー）
       ↓
④ 初回1問：「このサブスクがなくなったら困りますか？」
   → 「すぐ困る」「少し困る」「あまり困らない」（スキップ可）
       ↓
⑤ 登録完了
```

### 8.2 あいまい検索の実装

```
検索対象：ServiceCatalog.canonicalName + commonAliases（カンマ区切り）
正規化  ：全角→半角、大文字→小文字、カタカナ→ひらがな
ライブラリ：Fuse.js（クライアントサイド・軽量）

例：「ネトフリ」入力
  → commonAliases に「ネトフリ」を含む Netflix がヒット
  → ユーザーが選択 → matchedServiceId = "netflix_id"
```

### 8.3 `usage_type` の選択肢（カタログ外サービスの場合）

ユーザーに技術用語を見せず、平易な選択肢で `usage_type` を決める。

| 選択肢（ユーザーに表示） | 設定される `usage_type` |
|---|---|
| iPhoneアプリで使う | `active_foreground` |
| 音楽・ポッドキャストなど裏で再生する | `active_background` |
| PC・テレビ・Webで使う（iPhoneでは使わない） | `active_other_device` |
| 保管・同期・常時稼働するサービス | `passive` |
| 会員特典・送料無料など権利として持っている | `entitlement` |

---

## 9. Shortcuts 連携

### 9.1 API の変更

既存の `/api/usage/daily` をそのまま使用する。`source` の値を追加するのみ。

```typescript
// schemas/usage.ts
source: z.enum(["ios_device_activity", "manual_synthetic", "ios_shortcut"])
  .default("ios_device_activity")
```

### 9.2 QR コード表示

サブスク詳細画面に「利用記録を自動化する」ボタンを追加する。

- `usage_type` が `active_foreground` または `active_background` のサブスクにのみ表示
- 押すと QR コードをモーダルで表示
- QR コードの中身：

```json
{
  "url": "https://api.subbuddy.example.com/api/usage/daily",
  "subscriptionId": "sub_abc123",
  "subscriptionName": "Netflix"
}
```

- QR コード生成ライブラリ：`qrcode`（npm）をサーバーサイドで生成、または `qrcode.react` でクライアントサイド生成

---

## 10. レコメンド表示 UI

### 10.1 一覧画面

```
[解約検討] Netflix  ¥1,590/月
  ・30日間利用がありません
  ・同カテゴリに Disney+ があります
  → 解約で年間¥19,080節約

[ダウングレード検討] Netflix  ¥1,590/月
  ・広告つきプラン（¥790/月）に変更できます
  → 変更で年間¥9,600節約

[継続] Spotify  ¥980/月
  ・該当する見直し条件がありません
```

### 10.2 詳細画面

```
推奨：解約検討

該当する状況：
  ■ 使っていない
    iPhoneでの利用が30日間ありません
    ※TV/PCでの利用は計測外です

  ■ 重複で割高
    動画配信カテゴリに Disney+（¥990/月）もあります

  ■ 安いプランがある
    広告つきスタンダード（¥790/月）に変更できます

アクション：
  ・解約する → 年間¥19,080の節約
  ・ダウングレードする → 年間¥9,600の節約

[利用記録を自動化する]  ← QR コード表示ボタン
```

---

## 11. 知識ベースの初期データ

### 11.1 格納場所と形式

```
apps/web/prisma/seed/service-catalog.json
```

JSON ファイルでリポジトリに含め、seed スクリプトで DB に投入する。

### 11.2 データ構造

```json
[
  {
    "canonicalName": "Netflix",
    "category": "video_streaming",
    "usageType": "active_foreground",
    "commonAliases": "ネットフリックス,ネトフリ",
    "plans": [
      {
        "name": "広告つきスタンダード",
        "monthlyPrice": 790,
        "isFreeTier": false,
        "verifiedAt": "2026-06-01",
        "sourceUrl": "https://www.netflix.com/signup"
      },
      {
        "name": "スタンダード",
        "monthlyPrice": 1590,
        "isFreeTier": false,
        "verifiedAt": "2026-06-01"
      }
    ],
    "alternatives": [
      { "toCanonicalName": "Disney+", "relation": "same_category" },
      { "toCanonicalName": "Amazon Prime Video", "relation": "same_category" }
    ]
  }
]
```

### 11.3 MVP の対応件数

主要50件。選定基準：

1. product-requirements §4 に明示されているサービス
2. 日本で利用者が多いサブスクリプション
3. 代替関係が明確なもの（動画配信同士、音楽配信同士等）

### 11.4 鮮度管理

- 各プランに `verifiedAt` を持たせる
- 6ヶ月超過（`config.knowledgeBaseStaleDays`）で信頼度を `staleConfidenceMultiplier`（0.7）に低下
- P3/P4 の判定時に料金を信頼度で補正する
- 月1回の Gemini 自動チェック＋承認は本ステアリング外（運用ツールとして別途構築）

---

## 12. 影響範囲まとめ

### 新規作成

| ファイル/テーブル | 内容 |
|---|---|
| `ServicePlan` テーブル | サービスのプラン別料金 |
| `ServiceAlternative` テーブル | サービス間の代替関係 |
| `prisma/seed/service-catalog.json` | 知識ベースの初期データ（50件） |
| カタログ選択 UI コンポーネント | あいまい検索＋候補選択 |
| 初回1問 UI コンポーネント | 「なくなったら困るか」3択 |
| QR コード表示コンポーネント | Shortcuts 設定用 |
| パターン表示 UI コンポーネント | 根拠・節約額の表示 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | ServiceCatalog に `usageType` 追加、Subscription に3フィールド追加 |
| `computeRecommendation.ts` | パターン判定方式に全面書き換え |
| `reasons.ts` | パターン別理由文に書き換え |
| `config/scoring.ts` | しきい値をパターン判定用に変更 |
| `recompute.ts` | 知識ベース取得・`usageType` 解決を追加 |
| `schemas/usage.ts` | `source` に `ios_shortcut` 追加 |
| `schemas/subscription.ts` | 3フィールド追加 |
| 登録画面 | カタログ選択式＋初回1問 |
| 詳細画面 | パターン表示＋QR コード |
| レコメンド一覧画面 | パターンバッジ＋根拠 |
| `computeRecommendation.test.ts` | パターン判定のテストに書き換え |
| `docs/product-requirements.md` | §1, §8.3, §8.5, §10 |
| `docs/functional-design.md` | §8 判定ルール |
