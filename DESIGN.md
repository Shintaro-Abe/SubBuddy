---
name: SubBuddy — Serene Capital (Hybrid)
# 背景は Aesop サイト寄りの「ごく淡い暖色オフホワイト」。文字はやや濃いめの暖色墨。
colors:
  surface: '#f6f4ee'              # ページ背景（淡い暖色オフホワイト）
  surface-dim: '#e6e1d6'
  surface-bright: '#faf8f2'
  surface-container-lowest: '#fdfcf9'  # カード（背景よりわずかに明るく浮かせる）
  surface-container-low: '#f1eee6'
  surface-container: '#ece7dc'   # サイドバー/トラック等
  surface-container-high: '#e6e1d6'
  surface-container-highest: '#ddd6c7'
  on-surface: '#26231f'          # 本文・見出しの墨（濃いめ）
  on-surface-variant: '#48443c'  # 補助テキスト
  inverse-surface: '#2c2925'
  inverse-on-surface: '#f3f0ea'
  outline: '#6f6a5c'             # キャプション/弱い前景
  outline-variant: '#e6e1d6'     # 罫線（hairline）
  surface-tint: '#566155'
  primary: '#475347'             # セージ緑（継続・主要アクション）
  on-primary: '#ffffff'
  primary-container: '#3c4a3e'   # 深緑カード（見直しメモ）
  on-primary-container: '#eef3ee'
  inverse-primary: '#bdcaba'
  secondary: '#5f6b5e'           # セージ寄りグレー（実装=design.css --sage2。グラフ補助/アバター）
  on-secondary: '#ffffff'
  secondary-container: '#e9e4d8'
  on-secondary-container: '#5b574e'
  tertiary: '#73442b'            # テラコッタ（解約検討）
  on-tertiary: '#ffffff'
  tertiary-container: '#8f5b40'
  on-tertiary-container: '#ffe1d4'
  error: '#a3392e'              # 赤（強い解約候補のみ・やや沈めた赤）
  on-error: '#ffffff'
  error-container: '#f3dcd6'
  on-error-container: '#5e120c'
  background: '#f6f4ee'
  on-background: '#26231f'
  surface-variant: '#e6e1d6'
  # 実装で具体化した派生色（design.css／globals.css で使用。Stitch トークンには無い）
  sidebar: '#efece4'             # サイドバー背景
  nav-active: '#eaeee4'          # ナビ現在地の淡いセージ背景
  graph-secondary: '#5f6b5e'     # グラフ補助バー/アバター（--sage2）
# タイプスケールは4段だけ（段数を絞って階層を明確化＝視認性向上）。
# 和文＝下記フォント。欧文/数字フォールバック＝Display:EB Garamond / Body・Data:Geist。
typography:
  display:        # 大見出しのみ。明朝はここだけ（28px未満で明朝を使わない）
    fontFamily: Shippori Mincho
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 52px
    letterSpacing: '0'
  display-mobile:
    fontFamily: Shippori Mincho
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: '0'
  title:          # 画面/セクション/カード見出し
    fontFamily: Zen Kaku Gothic New
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: 0.02em
  body:           # 本文・表セル・一覧の文字すべて
    fontFamily: Zen Kaku Gothic New
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 29px
    letterSpacing: 0.02em
  caption:        # ラベル・補足・最終利用・% など
    fontFamily: Zen Kaku Gothic New
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 21px
    letterSpacing: 0.06em
  num:            # 金額・件数。新サイズは作らず「乗っている段のサイズ」を継承しフォントだけ切替
    fontFamily: BIZ UDPGothic   # 実装上のウェイトは 400/700 のみ（500 は無い）。段のウェイトを継承
    fontWeight: '400'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-desktop: 64px
  container-padding-mobile: 24px
  gutter: 24px
  section-gap: 48px
---

# SubBuddy デザインシステム（DESIGN.md）

> このファイルは SubBuddy Web（`apps/web`）の **デザインの源（Single Source of Truth）**。
> 上のフロントマター（colors / typography / spacing / rounded）は Stitch の design.md 形式と互換で、
> Stitch ツール（`upload_design_md` / `create_design_system_from_design_md`）と往復同期できる。
> 由来：Stitch プロジェクト「Subsc Calm Manager」のテーマ **Serene Capital** ＋ MUJI/Aesop ハイブリッド方針。
> 関連メモリ：[[web-ui-design-direction]]（静謐なエディトリアル）。
>
> **整流メモ（2026-06-18）**：実アプリ `apps/web`（`globals.css`／`layout.tsx`）へ全画面を実装。
> 実装の値の正は `tmp/stitch-calm/design.css`。本ファイルは design.css に合わせて整流済み
> （secondary=#5f6b5e／主ボタン10px／影 0 6px 28px／入力8px／数字ウェイト400・700／カテゴリバー単色／派生色 sidebar・nav-active を明記）。

## 1. 目指す体験（ブランド & トーン）

「**見直しの相棒**」にふさわしい、静かで信頼できる体験。日本の *間（ま）*＝余白を活かし、急かさない。
- **MUJI（実用）×Aesop（編集）のハイブリッド**：整然とした一覧性に、雑誌的なセリフ見出しと支出グラフの見せ場を足す。
- **煽らない（最優先・[[external-lan-sync-strategy]] とは別の UI 原則）**：「今すぐ解約」等の断定や不安を煽る表現・高彩度の警告色を使わない。節約額は事実として控えめに。判断は人に委ねる。
- 静的でも成立（アニメーションは必須でない）。

## 2. カラー

**ごく淡い暖色オフホワイト（Aesop サイト寄り・`#f6f4ee`）**を土台に、文字はやや濃いめの暖色墨（`#26231f`）。**セージ緑（primary）を1色アクセント**。お金アプリの警告は赤を多用せず、**テラコッタ（tertiary）**で和らげ、赤（error `#a3392e`）は「強い解約候補」だけに限定。

### 判定色マッピング（重要・コードの `decision` と対応）

| decision（判定） | 意味 | ドット/前景色 | 使いどころ |
|---|---|---|---|
| `keep`（継続） | 続けてよい | primary `#475347`（セージ） | バッジ・ドット |
| `review`（様子見） | 経過観察 | muted amber `#8a6d3b` | バッジ・ドット |
| `consider_downgrade`（ダウングレード検討） | 安い案あり | tertiary `#73442b`（テラコッタ） | バッジ・ドット |
| `consider_cancel`（解約検討） | 見直し対象 | tertiary-container `#8f5b40` | バッジ・ドット |
| `strong_cancel_candidate`（強い解約候補） | 強く見直し | error `#a3392e`（赤・**ここだけ**） | バッジ・ドット |
| observing（観測中） | データ確保中 | outline `#6f6a5c`（グレー） | バッジ・ドット |

- グラフ（支出可視化）はセージ緑を基調に。**警告の赤は使わない**。
  - 実装（design.css）では、カテゴリ別バーは単色のセージ寄りグレー（`--sage2 #5f6b5e`）で統一（多色化は将来の選択肢として保留）。月次推移は当月のみ濃いセージ（`.cur`）、他月は淡いセージ（`--sagebg`）。

## 3. タイポグラフィ

4段スケール（フロントマター参照）。和文＋欧文の対比：
- **Display（40px・明朝 Shippori Mincho）**：大見出し・金額の一文のみ。明朝はここだけ（28px未満で使わない）。
- **Title（20px・ゴシック Zen Kaku Gothic New 700）**：画面/セクション/カード見出し。
- **Body（16px・Zen Kaku Gothic New 400）**：本文・表セル・一覧の文字すべて。
- **Caption（13px・Zen Kaku Gothic New 500）**：ラベル・補足・最終利用・%。
- **数字（BIZ UDPGothic・tabular）**：金額・件数は新サイズを作らず、乗っている段のサイズでフォントだけ切替。欧文フォールバックは Display=EB Garamond / データ=Geist。

> 視認性の要：①明朝は大見出し限定 ②小さい文字はゴシック＋和文マイクロタイポ（本文 line-height 1.8・letter-spacing .02em、ラベルは .06em、ウェイトは400以上） ③`text-rendering:optimizeLegibility`＋`font-feature-settings:"palt"`＋`tabular-nums`。
> 実装メモ：`apps/web` に Shippori Mincho / Zen Kaku Gothic New / BIZ UDPGothic を `next/font/google` で追加（見出し用は必要ウェイトのみ・`display:"swap"`）。

## 4. レイアウト & 余白

- 12カラム（desktop）/ 4カラム（mobile）、8px グリッド。余白は広め（`section-gap` 48px）。
- ヒーロー（合計）は中央 or セリフ一文、データ一覧は左寄せ。
- カード 16px（`.panel`）、入力 8px（`.input`）、主ボタン 10px（`.btn`／実装値）。罫線は細く低コントラスト。
- 影は弱いアンビエント（`0 6px 28px rgba(95,107,94,.05)`＝セージの淡い影。黒は使わない／実装値）。
- **iPhone向けWeb**：1023px以下は「ホーム・契約・見直し」の下部ナビと右上の「その他」を使い、本文は1列中心とする。入力画面では下部ナビを隠す。1024px以上は左サイドバーを維持する。
- **狭幅の優先順**：ホームは今月の支出、次の操作、更新・見直し、詳しい概況の順。月次推移は月・比較バー・金額の縦リスト、一覧は縦型カード、フォームは1列とする。
- **安全領域と操作**：320px以上でページ全体の横スクロールを出さず、`safe-area-inset-*`、44px操作領域、入力文字16px以上、200%相当の文字拡大を守る。端末・ブラウザ名による専用CSSは作らない。

## 5. ページ構成（ハイブリッドの“良いとこ取り”）

### ダッシュボード（`/`）
- **Aesop**：セリフ一文の見出し「今月の支出は **¥16,480** でした。」＋補足（継続 8件・年額見込み ¥197,760）。
- **支出の内訳**ブロック：左に月次推移の棒グラフ、右にカテゴリ別内訳（横バー＋%）。
- **MUJI**：「見直し候補」を**表形式**（サービス／カテゴリ／月額／判定／最終利用）。
- 深緑の「**見直しメモ**」カード：根拠タグ（使っていない／安い代替がある／更新が近い）＋中立文「根拠をもとに、続けるか見直すかはご自身で判断できます。」＋控えめボタン「根拠の詳細を見る」。

### 支出の内訳（`/spending`・UI表示名は「支出の内訳」）
- Aesop の Spending Taxonomy の見せ方を主役に：月次推移・カテゴリ内訳・年額見込み。

### サブスク詳細（`/subscriptions/[id]`）
- 契約情報＋判定バッジ＋**判定根拠タグ（matchedPatterns）**＋理由文＋解約導線。根拠タグは §2 の判定色に従う。

### サブスク一覧 / レコメンド / 更新間近
- MUJI の表・カードを踏襲。モバイルは下部タブナビ。

## 6. コンポーネント

- **ボタン**：Primary＝セージ塗り＋白 `label-caps`／Secondary＝1px セージ枠 or ゴースト／Danger は乱用しない。
- **判定バッジ/根拠チップ**：ドット＋ラベルの上品な形（塗りつぶしの主張は控えめ）。色は §2。
- **サブスク表**：行は淡い hover、細い下罫線、金額は `data-mono`。
- **見直しメモカード**：`primary-container`（深緑）背景＋`on-primary-container`。煽らない一文を必ず添える。
- **入力**：フローティングラベル、フォーカスは枠の太さで示す（色変化に頼らない）。
- **ワードマーク（アプリ名）**：「SubBuddy」は見出しと同じ墨色（アクセント色を付けない）。タグライン（サブタイトル）は付けない。
- **ナビ項目**：行頭マーカーは小さな丸ドット（四角は使わない）。アクティブは淡いセージ背景＋太字。

## 7. 文言（日本語・中立）

- すべて日本語。ナビ・カテゴリも日本語（Dashboard→ダッシュボード、Video→動画 等）。
- 専門用語は初出に「（＝平たい説明）」を添える（[[writing-plain-japanese]]）。
- 共有用ドキュメント/画面に内部項番（P1 等）を出さない（[[no-internal-codes-in-docs]]）。判定根拠は内容を表す日本語タグで。
- 画面の語彙は一般的な言葉に：「支出の可視化」→「**支出の内訳**」、「気にかけたい契約」→「**見直し候補**」。

## 8. Stitch との同期

- 由来プロジェクト：Subsc Calm Manager（`projects/5208444391091834087`）／テーマ Serene Capital（`assets/d279ff4260764fa0ae3eab0f80214c24`）。
- ハイブリッド試作画面：`projects/.../screens/9aa30be4fdb64d17889f3572e05d763c`（`tmp/stitch-calm/hybrid-dashboard.{png,html}`）。
- このファイルを更新したら Stitch へ `upload_design_md`、Stitch 側で更新したら本ファイルへ反映、で同期する。
