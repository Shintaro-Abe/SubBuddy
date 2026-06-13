# 設計：Gemini 汎用相談スキル（OAuth 限定）

requirements.md（承認済み）に基づく設計。**認証は無料 OAuth のみ。API キー経路は持たない。**

## 構成
```
.claude/skills/gemini/
  SKILL.md                 # 起動条件・モード・プロンプト作法・PIIガード・縮退
  scripts/gemini-ask.sh    # gemini CLI を安全フラグで叩く薄いトランスポート
```

## gemini CLI 呼び出し方針（検証済み・v0.45.2）
- 非対話：`gemini -p "<prompt>"`（stdin があれば prompt は末尾に追記）。
- 読み取り専用：`--approval-mode plan`（編集系ツール禁止、read-only ツールのみ）。
- トラスト降格回避：`--skip-trust`（未トラストだと plan→default に降格するため必須）。
- 出力：`-o text`（既定）。機械処理が要れば `-o json`。
- モデル：`-m`。既定 `gemini-2.5-flash`（高速・高頻度）、深掘り `gemini-2.5-pro`。

## 認証（OAuth 限定）
- 利用前提：ユーザーが **VS Code 統合ターミナルで** `gemini` を対話起動し "Login with Google"
  （無料枠 = Gemini Code Assist）でログイン済み。完了で `~/.gemini/oauth_creds.json` が生成される。
- Claude の `! ` は非対話 TTY のため OAuth ログインには使えない（手順案内のみ）。
- **API キーは扱わない**：helper は `GEMINI_API_KEY` や `~/.gemini/.env` を読み込まない／参照しない。

## 安全設計（PII・機微データ）
- **隔離 cwd**：helper は `mktemp -d` した一時ディレクトリで gemini を起動。
  リポジトリを workspace に含めない（`--include-directories` 不使用）。
  → Gemini がローカルの実データ／コードを暗黙に読み外部送信する事故を防ぐ。
- コード文脈が必要な場合のみ、Claude 側で PII レビュー済みの**抜粋テキスト**を
  プロンプトに直接埋め込む（合成データ／一般化を優先）。
- 検索クエリ・プロンプトに実 PII・資格情報・社外秘を含めない。

## helper（gemini-ask.sh）責務 = 薄いトランスポート
1. `gemini` バイナリ解決（無ければ `npx --yes @google/gemini-cli`）。
2. **認証チェック（OAuth のみ）**：`~/.gemini/oauth_creds.json` の存在、または
   `~/.gemini/settings.json` の `selectedAuthType` を確認。無ければ
   VS Code ターミナルでの OAuth ログイン手順を stderr に出して exit 3（ハング回避）。
   ※ API キー判定は行わない。
3. モデル別名解決：`flash`→2.5-flash / `pro`→2.5-pro / それ以外はそのまま。
4. 一時 cwd で `gemini --skip-trust --approval-mode plan -m <model> -o text -p "$(cat)"`。
   プロンプト本文は stdin から受ける（複数行・引用安全）。
- 調査の「枠組み」（出典必須・不確実は明言 等）は helper に固定せず SKILL 側でモード別に組み立てる。

## モード（SKILL 側で使い分け）
- research（既定）：Web 検索グラウンディング＋出典 URL 付き簡潔回答。
- second-opinion：Claude の案を要約提示し、穴・別案を求める。
- summarize / translate / brainstorm：素の問い合わせ。
いずれも plan モード（読み取り専用）で実行。

## 出力
- 既定：Claude が gemini の結果を要約し、出典付きでチャット返答。
- 任意保存（ユーザー希望時のみ）：`research/[YYYYMMDD]-[slug]/gemini-<topic>.md`
  （日付はユーザー提示の現在日付。推測しない）。

## feature-research との棲み分け
- `gemini`：軽量・高頻度・単発の問い／第二意見。実装戦略やコード探索はしない。
- `feature-research`：重い5ステップ。実装方式の調査＋このリポジトリ向け実装戦略立案。
- 必要なら `gemini` の結果を `feature-research` の Step1 材料として引き継ぐ。

## 既存スキル実体との整合（実装フェーズで対応）
- 先行作成済みの `SKILL.md` / `gemini-ask.sh` は本設計に合わせて改修する：
  - helper から **API キー経路（`~/.gemini/.env` ロード・`GEMINI_API_KEY` 判定）を除去**。
  - 認証チェックと未設定メッセージを **OAuth 限定**に統一。
  - SKILL.md §6（縮退）の認証案内を OAuth 限定に統一。
