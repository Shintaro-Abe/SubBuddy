# 要求：Web UI 実装（全画面を新デザインへ刷新）

> 作成日：2026-06-18 ／ ブランチ：`feat/spending-and-design`
> 上位文脈：`DESIGN.md`（デザインの正式基準）と `tmp/stitch-calm/`（モック7画面・`design.css`）を、実アプリ `apps/web` に実装するUI刷新。
> 引き継ぎ：`tmp/subbuddy-ui-handoff-2.md`。

## 背景

実アプリ（Next.js + Tailwind）はまだ旧 zinc UI で、決定済みの新デザイン（静謐なエディトリアル＝MUJI×Aesop ハイブリッド）が未反映。
今回（2時間の作業会）で、**全画面を新デザインへ刷新**する（`http://localhost:3000` にアクセスすれば全画面が新UIで表示される状態を目指す）。
データ取得ロジック（server components / repositories / DB）は変更せず、**見た目だけ**新デザインへ移植する。

## 今回やること（スコープ）

**土台（先に固める）**
1. **フォント導入**：`next/font/google` で Shippori Mincho（明朝）／Zen Kaku Gothic New（ゴシック）／BIZ UDPGothic（数字）＋欧文 EB Garamond／既存 Geist Mono。日本語は `preload:false`・`display:"swap"`。
2. **デザイントークン整備**：`globals.css` に `design.css` のトークン（colors / spacing / rounded / typography）と共通部品クラスを移植。フォント指定は next/font の CSS 変数へ差し替え。
3. **共通シェルをサイドバー化**：`(dashboard)/layout.tsx` をモック準拠のサイドバー（アプリ名＝墨色・丸ドットナビ・現在地ハイライト・「＋サブスクを登録」）に。

**全画面の移植（土台の上で並列実施）**
4. ダッシュボード `/`（← `dashboard-current.html`：基準画面）
5. サブスク一覧 `/subscriptions`（← `subscriptions-list.html`：カードグリッド）
6. サブスク詳細 `/subscriptions/[id]`（← `subscription-detail.html`：契約情報＋判定＋根拠タグ＋reason）
7. 登録/編集フォーム `/subscriptions/new`・`/subscriptions/[id]/edit`（← `subscription-new.html`）
8. 支出の内訳 `/spending`（← `spending.html`：月次推移＋カテゴリ内訳。UI表示名「支出の内訳」）
9. レコメンド `/recommendations`（← `recommendations.html`：判定別グループ）
10. 更新間近 `/renewals`（← `renewals.html`：日数バッジ＋フィルタタブ）

## 今回やらないこと（スコープ外）

- データ取得・ドメインロジック・API・スキーマの変更（見た目のみ。データは常に実データ）。
- `DESIGN.md` の整流（design.css に合わせて後続で更新。時間が余れば着手）。
- 認証・ユーザー情報まわり（ローカルファースト単一ユーザー前提。モックのアバター/ユーザー欄は省略 or 簡素化）。
- 新機能の追加（既存画面の機能・導線は維持する）。

## 受け入れ条件

- [ ] 新フォント3種＋欧文が `apps/web` で適用され、4段タイプスケール（Display=明朝/Title/Body/Caption=ゴシック・数字=BIZ UDPGothic tabular）が効く。
- [ ] 背景＝淡い暖色オフホワイト `#f6f4ee`、文字＝墨 `#26231f`、アクセント＝セージ `#475347` が反映。
- [ ] サイドバー共通シェルが全 `(dashboard)` 画面に適用され、現在地がハイライトされる。ナビ行頭は丸ドット、アプリ名はアクセント色なしの墨。
- [ ] **全画面（ダッシュボード／一覧／詳細／登録・編集／支出の内訳／レコメンド／更新間近）が新デザインで表示**され、旧 zinc 配色が残らない。各画面の機能・データ・導線は従来通り動く。
- [ ] `/spending` の UI 表示名は「支出の内訳」。判定色は keep=セージ/review=琥珀/consider_*=テラコッタ/strong_cancel=赤（ここだけ）/observing=グレー。
- [ ] グラフに警告赤を使わない。煽らない中立トーン。各画面の空状態も自然。
- [ ] `npx eslint src` と `tsc`（型）と `vitest`（spending 含む）がグリーン。可能なら `next build` 成功。

## 制約・守ること

- **値の正＝`design.css`**（DESIGN.md との齟齬は design.css 優先。DESIGN.md は後で整流）。
- 日本語・中立・平易（[[writing-plain-japanese]]）。画面に内部項番を出さない（[[no-internal-codes-in-docs]]）。
- PII は合成データのみ。`spikes/`・`obsidian/`・`devcontainer.json` 等の別セッション領域に触れない。
- コミットはユーザー明示時のみ。`pre-commit-secret-scan` を使う。
- 用語：機能名＝支出可視化／ルート＝`/spending`／UI表示名＝**支出の内訳**。
