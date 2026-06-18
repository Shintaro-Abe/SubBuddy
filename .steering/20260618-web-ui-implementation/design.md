# 設計：Web UI 実装（全画面を新デザインへ）

> 対象：`apps/web`／基準：`tmp/stitch-calm/design.css`＋各モックHTML／値の正＝design.css。

## 1. 実装アプローチ

**「design.css のクラスを移植して使う」方式**を採る（各クラスを Tailwind ユーティリティへ逐一翻訳しない）。理由：
- design.css は全部品（サイドバー・パネル・表・バッジ・チップ・グラフ・カード・フォーム・フッター）を網羅した完成版。最速かつモック完全一致。
- レイアウト微調整は Tailwind ユーティリティを併用してよい（`@import "tailwindcss"` は残す）。

### CSS の構成（`globals.css`）
1. `@import "tailwindcss";` は残す。
2. design.css の `:root` トークンを移植。**フォントだけ next/font の CSS 変数へ差し替え**：
   - `--sans: var(--font-sans-jp), system-ui, sans-serif;`
   - `--mincho: var(--font-mincho), serif;`
   - `--num: var(--font-num), sans-serif;`
   - `--lat: var(--font-lat), serif;`
3. design.css の `body` / 4段スケール（`.display/.title/.body/.caption/.num`）/ 全部品クラスを移植。
4. 既存の `@theme inline`（background/foreground）は `--color-background:#f6f4ee` `--color-foreground:#26231f` に寄せ、ダークモード `@media` ブロックは削除（本デザインはライト固定）。

### フォント（`app/layout.tsx`）
- `next/font/google`：Zen Kaku Gothic New（400/500/700）・Shippori Mincho（600）・BIZ UDPGothic（400/500）は `preload:false`・`display:"swap"`。EB Garamond（600・latin）・既存 Geist Mono。
- 各 `variable`（`--font-sans-jp/--font-mincho/--font-num/--font-lat/--font-geist-mono`）を `<html>` に付与。`lang="ja"`。

## 2. 共通シェル（`(dashboard)/layout.tsx`）

モック `dashboard-current.html` の `.app/.side/.main` 構造へ。
- `.side`：ブランド「SubBuddy」（墨・明朝・アクセント色なし）＋丸ドットナビ＋spacer＋「＋サブスクを登録」ボタン（`/subscriptions/new`）。モックのアバター/ユーザー欄は**省略**（単一ユーザー前提）。
- ナビ項目：`{href,label}`。**現在地ハイライト**は `usePathname()` が要るので小さな**クライアントコンポーネント** `components/SidebarNav.tsx` に切り出し（`"use client"`）。アクティブ判定＝完全一致＋（`/subscriptions` はサブパスも active）。
- ラベル：ダッシュボード/サブスク一覧/**支出の内訳**/レコメンド/更新間近。
- `.main` に `children`。

## 3. 共通コンポーネントの restyle（土台フェーズで先に対応＝並列の衝突回避）

| ファイル | 変更 |
|---|---|
| `components/DecisionBadge.tsx` | ドット＋ラベル形式（`.badge` + `.dot` + 判定色クラス）へ。判定→色は §2 マッピング。 |
| `lib/display.ts` | `DECISION_BADGE_CLASS` を新方式（`b-keep/b-review/b-consider/b-strong/b-observe`）に置換 or 併設。ラベル・`formatYen` 等は維持。 |
| `components/RecomputeButton.tsx` | `.btn`/`.btn.ghost` へ。 |

> shared な `DecisionBadge`/`RecomputeButton` は**土台フェーズで私が対応**し、ページ側サブエージェントはこれらを「使うだけ」。これで同一ファイルへの並列編集を避ける。

## 4. ページ別移植（土台完成後に並列実施）

各タスクは「**データ取得・props・ロジックは一切変えず、JSX の見た目だけ** design.css クラス＋モックに合わせる」。`Link`/`server component`/`searchParams`/`notFound` 等の挙動は維持。

| # | ページ | 編集ファイル | モック | データ源（維持） |
|---|---|---|---|---|
| 1 | ダッシュボード | `(dashboard)/page.tsx` | dashboard-current.html | `getSubscriptionsWithLatestRecommendation`。StatCard→`.panel`、見出し→`.display`、見直し候補は表（MUJI）、深緑「見直しメモ」カード。 |
| 2 | サブスク一覧 | `subscriptions/page.tsx` ＋ `components/SubscriptionCard.tsx` | subscriptions-list.html | 同上。`.scard` グリッド。 |
| 3 | サブスク詳細 | `subscriptions/[id]/page.tsx`（＋必要なら `DeleteSubscriptionButton`/`ShortcutsQrCode` の見た目） | subscription-detail.html | `getSubscription`/`listLatestRecommendations`/`parseMatchedPatterns`。契約情報＝表、根拠タグ＝`.chip`、reason、解約導線。 |
| 4 | 登録/編集フォーム | `subscriptions/new/page.tsx`・`subscriptions/[id]/edit/page.tsx`（＋共通フォーム部品があれば） | subscription-new.html | 既存の form action/バリデーションは維持。`.field/.label/.input/.help/.seg`。 |
| 5 | 支出の内訳 | `spending/page.tsx` | spending.html | `aggregateSpending`。`.display`「支出の内訳」、`.bars`（当月=`.cur`セージ）、`.catrow`。 |
| 6 | レコメンド | `recommendations/page.tsx` | recommendations.html | 判定別グループ。`DecisionBadge`＋一覧。**節約額の赤字表現は中立トーンへ**（design.css に警告赤を使わない方針／事実として控えめに）。 |
| 7 | 更新間近 | `renewals/page.tsx` | renewals.html | `searchParams.days` 維持。`.rowitem`＋`.daysbadge`（近い＝`.soon` テラコッタ）。フィルタタブ。 |

### 中立トーンの注意（重要）
- 旧UIの `text-red-600`「解約で年間〇〇節約」等の**煽り・赤の多用は廃止**。節約額は事実として控えめに（赤は strong_cancel のドットのみ）。
- 画面に内部項番を出さない。判定根拠は日本語タグ。

## 5. 並列実行プラン

1. **土台（私・直列）**：`layout.tsx`（フォント）→ `globals.css`（design.css 移植）→ `(dashboard)/layout.tsx` ＋ `SidebarNav.tsx` → `DecisionBadge`/`RecomputeButton`/`display.ts`。
2. **ページ7本（サブエージェント・並列）**：上表の #1〜#7。各サブエージェントは**自分の編集ファイルのみ**を触る（共有部品は読むだけ）。各々へ「該当モックHTML＋既存ページ＋design.css クラス語彙＋中立トーン規約」を渡す。
3. **検証（私）**：`npx eslint src`／`tsc --noEmit`／`vitest run`／可能なら `next build`。崩れは私が修正。

## 6. 影響範囲・リスク

- `globals.css` のグローバル要素セレクタ（`body`,`table`,`th`,`td`）は全画面に影響。旧 zinc 画面も背景・フォントが変わる（移植後は全画面新デザインなので問題なし）。
- ダークモード削除＝ライト固定（DESIGN.md 準拠）。
- next/font 日本語は `preload:false`（初回 FOUT 可。許容）。
- 並列編集の衝突回避＝共有ファイルは土台で確定、ページは1ファイル1担当。
- `vitest` は spending のロジックのみ（UI 変更はテスト対象外）。型と build で UI の壊れを担保。

## 7. やらないこと
- データ/ドメイン/API/スキーマ変更、新機能追加、DESIGN.md 整流（余れば別途）。
