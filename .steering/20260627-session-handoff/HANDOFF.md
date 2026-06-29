# 引き継ぎ書（ツール整備・市場調査・talk-draft修正・handoffスキル作成）

> 作成：2026-06-27 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`feat/spending-and-design`
> 範囲：本セッションのやり取りのみ。サブスク本体の機能実装は今回していない（過去セッションの容量ゲート等はスコープ外）。

---

## 1. 現在地（ひとことで）

本セッションは作業ツールの整備と文書系が中心。(a) Gemini スキルを **APIキー認証**に切替、(b) SubBuddy の**市場調査**を実施、(c) Codex による **talk-draft レビュー**と修正適用、(d) **引き継ぎ書作成スキル `handoff`** を新規作成。
コード（アプリ本体）の変更はなし。**本セッションのコミットは未実施**（すべて working tree に残置）。

---

## 2. このセッションでやったこと

### ✅ Gemini スキルを APIキー認証へ切替（未コミット）
- 背景：OAuth 未設定で `gemini-ask.sh` が exit 3。ユーザー方針でAPIキー認証へ変更（キーは Gemini 側に設定済み）。
- 原因：helper の認証チェックが**旧キー名 `selectedAuthType` しか見ておらず**、新形式 `security.auth.selectedType="gemini-api-key"` を認識できなかった。
- 修正（`scripts/gemini-ask.sh`）：認証検出を拡張（env `GEMINI_API_KEY`/`GOOGLE_API_KEY`、`~/.gemini/.env`、`selectedAuthType|selectedType` 両対応、`oauth_creds.json`/`gemini-credentials.json`）。未設定時の案内文も API キー優先＋OAuth代替に更新。
- `SKILL.md`：方針記述を「APIキー優先・OAuthも許容」に更新（§0・§6）。
- 検証：素の `flash` は通る（`AUTH_OK`）。**ただし `pro` は無料枠ゼロ（429 limit:0）、`flash`+Web検索(grounding) も 429 でリトライ地獄→タイムアウト**。→ このAPIキーでは**grounded検索が使えない**。
- 変更ファイル（未コミット）：`.claude/skills/gemini/SKILL.md`, `.claude/skills/gemini/scripts/gemini-ask.sh`

### ✅ SubBuddy の市場調査（同方向アプリの有無）
- 実施：Claude の WebSearch（出典付き）＋ Gemini（検索不可のため知識ベース）。両者の結論が一致。
- 結論（4軸）：
  - 軸1 ローカル/手動/銀行連携なし → **飽和**（Bobby, ReSubs, Wallos, SenticMoney, Costly, 国内 SubsHub・サブスク管理帳 等）
  - 軸2/3 解約代行・自動検出・理由付きアラート → **既存～部分存在**（Rocket Money, Kudos, Hiatus, マネーフォワードME, B2BのZluri/Zylo）
  - 軸4 **利用量・スクリーンタイムを根拠にB2Cで解約/見直し提案 → 前例が見当たらない**（＝SubBuddyの独自地点。技術背景：Screen Time/DeviceActivity APIが対象アプリIDを暗号トークンで秘匿）
- 注意：Gemini が挙げた "Tenyx"・"Bundle / Tokidoki" は Claude の検索結果に出現せず**要検証**（B2B代表は Zluri/Zylo が確実）。
- 18日前の既存調査（`competitor-market-research` メモ）と整合。新しい恒久メモ化はしていない。

### ⚠️ Codex レビュー2件（結果が分かれた）
- **talk-draft レビュー＝成功**（下記参照、指摘3点）。
- **市場調査レビュー＝実行不能**。Codex のサンドボックス（bwrap）初期化が失敗し、`/workspaces/SubBuddy/research/20260625-market-review-codex/input.md` どころか `/bin/bash -c pwd` すら exit 1。リポジトリ内にファイルを置いても読めず。**この環境では現状 Codex のファイル読取レビューが不安定**（talk-draft時は通っていた）。

### ✅ talk-draft の技術レビュー反映（未コミット）
- Codex 指摘（スライド7）3点を `talk-draft-ai-coding-dojo.md` に適用：
  1. 「7つのパターン」→ **「6つの型＋当てはまらなければ継続」**（継続は未マッチ時の既定で他6つと並列でない）
  2. 判定列の誇張・混在を是正（「使っていない＝解約検討」→ **様子見／長期完全未使用で強い解約候補**。判定は5種：継続/様子見/ダウングレード検討/解約検討/強い解約候補）
  3. 実装にない**「乗り換え検討」を削除** →「解約検討（理由：安い競合がある）」
- 該当箇所すべて修正（構成表31行・送り175行・見出し186行・表193–203行・当日メモ270行）。`7つ/7パターン/乗り換え検討` の残存ゼロを grep で確認。
- しきい値（7日・¥2,000・12ヶ月）と能動/受動の定義は Codex が実装一致を確認済み＝未変更。
- 変更ファイル（未コミット）：`talk-draft-ai-coding-dojo.md`

### ✅ 引き継ぎスキル `handoff` を新規作成（未コミット）
- `.claude/skills/handoff/SKILL.md`。核ルール＝**今セッションのやり取りのみ反映**（過去セッション・git履歴・無関係なリポジトリ情報は持ち込まない）。保存先は `.steering/[YYYYMMDD]-[title]/HANDOFF.md`、構成は既存HANDOFFに準拠。
- `skills-lock.json` への登録は不要（同ファイルは外部GitHub取得スキル専用。ローカル自作は対象外）。

---

## 3. 状態・検証結果

- talk-draft：grep で旧表現の残存ゼロを確認。
- Gemini helper：`flash` 素の呼び出しで `AUTH_OK`／exit 0。grounded検索は429で不可。
- Codex：talk-draft レビューは完走。市場調査レビューはサンドボックス障害で**未完**。

---

## 4. 再開時の最初の一手

1. working tree を確認：`git status --short`。本セッション分（gemini skill・talk-draft・handoff skill・research dir）は**未コミット**。
2. 市場調査の Codex レビューが必要なら、**Codex サンドボックスが復帰しているか先に確認**（`/codex:setup` か、talk-draft時のように小さな読取で疎通確認）。復帰しないなら Claude が直接レビューに切替。
3. Gemini で出典付き調査が要る場合は、**APIキーの grounding 枠が空くまで Claude の WebSearch を使う**（現状 grounded検索は429）。

---

## 5. 残・別スコープ（今回やらないこと）

- 市場調査の Codex レビュー（サンドボックス障害で保留）。入力は `research/20260625-market-review-codex/input.md`。
- 市場調査結果の恒久メモ化（必要なら `competitor-market-research` を更新）。
- talk-draft の内容自体のこれ以上の推敲（今回は技術整合の修正のみ）。
- 本セッション変更のコミット/PR（未実施）。

---

## 6. 申し送り（小）

- **Codex サンドボックス（bwrap）がこの環境で不安定**。ファイル読取を伴う Codex 依頼は失敗しうる。
- **Gemini 無料APIキーは grounded Web検索が使えない**（`pro` は limit:0、`flash`+検索は429）。出典付き調査は Claude 側 WebSearch が確実。
- working tree には本セッション以外の未追跡/変更ファイルも多数（devcontainer・mcp・他research・skills整備等）。コミット時は関心ごとに分割。
- バックグラウンドの Codex/Gemini タスクが残っている可能性あり（市場調査レビューのネスト bg `b590ixg6d` 等）。
- 一時ファイルを1つリポジトリに残置：`research/20260625-market-review-codex/input.md`（Codex読取用に作成）。不要なら削除可。
