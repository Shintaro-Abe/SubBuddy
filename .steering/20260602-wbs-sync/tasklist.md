# タスクリスト（Tasklist） — WBS 同期の仕組み

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：作業単位ドキュメント（`.steering/20260602-wbs-sync/`）
> 作成日：2026-06-03
> 関連：本作業の `requirements.md` / `design.md`、`docs/development-guidelines.md`（テスト・Git・品質）、`CLAUDE.md`（PII・段階承認）

---

## 0. 確定した設計判断（実装の前提）

design §11 の推奨で確定。

| # | 論点 | 確定 |
|---|---|---|
| 1 | 正本フォーマット | **YAML（`wbs/wbs.yml`）**。人間用の `wbs/wbs.md` 一覧は任意生成（後回し可） |
| 2 | 配置 | リポジトリ直下に **`wbs/`** を新設 |
| 3 | 書き込み経路 | **スクリプトから Workspace CLI を直呼び**（dry-run/テスト容易）。Claude の対話 MCP は補助 |
| 4 | ツーリング言語 | **Node / TypeScript**（Vitest 再利用） |
| 5 | ロールアップ | **Sheet 数式**で集計（同期は数式を壊さない） |
| 6 | 認証方式 | **v1 は サービスアカウント（SA）を既定**（方針変更 2026-06-03）。`gws` v0.22.5 の OAuth ブラウザログインが既知バグ（[#695](https://github.com/googleworkspace/cli/issues/695)）で失敗するため。SA 鍵は `secrets/`、`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` で指定、対象シートを SA に共有。OAuth は将来バグ修正後の選択肢 |

> フックの正確なイベント名・入出力契約は実装時に公式 Hooks リファレンスで確定する（design §5.3 / NFR-4）。

---

## 凡例

- 状態：`[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了 / `[-]` 保留
- 各タスクに **WBS ID**（本機能の結合キーと同じ体系）と **完了条件** を付す。

---

## フェーズ 1：準備・環境セットアップ（WBS 1）

- [ ] **1.1** `wbs/` ディレクトリと雛形を作成
  - 完了条件：`wbs/`、`wbs/lib/`、`wbs/scripts/` が存在し、Node/TS のビルド・実行ができる
- [ ] **1.2** ツーリングの依存とスクリプトを用意（TS 実行・YAML パース・Vitest）
  - 完了条件：`wbs` 配下で型チェック・テスト・スクリプト実行コマンドが通る
- [x] **1.3** Google 側準備（GCP プロジェクト、Sheets/Drive API 有効化）※**ユーザー手作業**
  - 手順書：[`manuals/wbs-google-setup.md`](../../manuals/wbs-google-setup.md) ステップ 1〜2
  - 完了条件：プロジェクト作成・API 有効化済み（✅ 完了）
- [x] **1.4** 公式 CLI `gws`（`@googleworkspace/cli`）を導入 ※Claude
  - 完了条件：`gws --version` が通る（✅ v0.22.5 導入済み）
- [x] **1.4b** 認証＝**サービスアカウント方式**（OAuth ブラウザは gws バグで不可）※**ユーザー手作業**
  - 手順書：[`manuals/wbs-google-setup.md`](../../manuals/wbs-google-setup.md) ステップ 3〜7
  - 完了条件：SA 作成・鍵を `secrets/` に配置、`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` 設定、対象シートを SA に「編集者」共有 → `gws sheets spreadsheets get` で疎通（✅ 「SubBuddy WBS」読み取り成功。要：SA に Service Usage コンシューマー付与＋シート編集者共有）
- [x] **1.5** 秘密情報の除外設定（`.gitignore` 確認、`wbs/.env.example` をダミーで作成）
  - 完了条件：`.env`・トークン・鍵が追跡対象外。`.env.example` はダミーのみ（AC-6）（✅ `.gitignore` 強化済み・検証済み、`wbs/.env.example`／`wbs/.env` 作成済み）

## フェーズ 2：spec・設定の整備（WBS 2）

- [x] **2.1** `wbs/wbs.yml` の正本スキーマを確定（標準 WBS 一式・§3.1 のフィールド）
  - 完了条件：サンプル WBS が標準 WBS 一式の全列を表現でき、Node から読み込める（AC-1）
- [x] **2.2** `wbs/wbs.config.yml`（spreadsheetId・シート名・列順・アーカイブ方針）を作成
  - 完了条件：**非秘密のみ**を含み、sync から参照できる（✅ 作成済み・spreadsheetId 記録済み）
- [ ] **2.3** （任意）`wbs/wbs.md`（テーブル表示）の生成方針を決める
  - 完了条件：v1 では生成有無を決定（後回し可）。決定を記録

## フェーズ 3：差分計算ロジック（WBS 3）

- [x] **3.1** `wbs/lib/diff.ts`（純粋関数）を実装：ADD / UPDATE / UNCHANGED / ARCHIVE
  - 完了条件：spec と Sheet 行から差分種別を算出（I/O 非依存）
- [x] **3.2** 値の正規化（日付・null/空文字の同一視）を実装
  - 完了条件：表記ゆれで誤検知しない
- [x] **3.3** `diff.ts` の単体テスト（Vitest・合成データ）
  - 完了条件：各分岐＋**冪等性（同一 spec 二回で全 UNCHANGED）**を検証（NFR-3 / AC-3）

## フェーズ 4：Sheets I/O アダプタ（WBS 4）

- [x] **4.1** `wbs/lib/sheets.ts`：`WBS`/`Archive` 行の読み取り・バッチ書き込み（CLI 経由）
  - 完了条件：読み取り・追加・更新・移送が CLI 経由で動作。差し替え点が局所化（FR-6 フォールバック）
- [x] **4.2** レート制限対策（バッチ更新）
  - 完了条件：複数行更新を 1 リクエストにまとめる（✅ clear＋単一 update で全行一括書き込み）

## フェーズ 5：同期スクリプト（WBS 5）

- [x] **5.1** `wbs/scripts/sync.ts --dry-run`：読み取り＋差分出力（副作用なし）
  - 完了条件：差分サマリ（ADD/UPDATE/ARCHIVE 件数と内容）を出力。書き込みしない
- [x] **5.2** `wbs/scripts/sync.ts --apply`：upsert＋アーカイブ移送
  - 完了条件：WBS ID キーで upsert。spec から消えた行は `Archive` へ移送し `WBS` から除去（US-10 / FR-3）
- [x] **5.3** 冪等性の結合確認
  - 完了条件：同一 spec で再 apply しても Sheet が不変（AC-3）
- [ ] **5.4** `sync.ts` 制御フローのテスト（I/O モック：dry-run/apply、未承認時は書かない）
  - 完了条件：承認フラグなしで `--apply` 経路が書き込みしないことを検証（AC-2b）

## フェーズ 6：確認ゲート（Claude オーケストレーション）（WBS 6）

- [ ] **6.1** 同期オーケストレータ（Claude Code の skill / command）を定義
  - 完了条件：`--dry-run`→差分提示→**AskUserQuestion で承認**→承認時のみ `--apply` の流れが動く
- [ ] **6.2** 差分の提示フォーマット（追加/更新/アーカイブを人が判断できる粒度）
  - 完了条件：承認前に変更内容が一覧で分かる（US-6 / FR-8 / AC-4）

## フェーズ 7：自動トリガ（フック）（WBS 7）

- [ ] **7.1** `wbs/scripts/detect-bolt-complete.mjs`：tasklist のチェックボックス解析で「全完了」を判定
  - 完了条件：全完了 / 一部未完 / タスクゼロ を正しく判定（テストあり）
- [ ] **7.2** 重複提案の抑止（最後に提案した状態のハッシュ等）
  - 完了条件：同一完了状態で繰り返し提案しない
- [ ] **7.3** `.claude/settings.json` に `PostToolUse` フックを追加（`.steering/**/tasklist.md` 対象）
  - 完了条件：tasklist 完了編集後に検知が走り、Claude へ同期提案が伝わる（FR-4）
- [ ] **7.4** 手動起動の併用確認
  - 完了条件：明示指示（「WBS を同期して」）でも同じオーケストレータが起動する

## フェーズ 8：Sheets 初期セットアップ（WBS 8）

- [x] **8.1** `WBS` / `Archive` / `Summary` シートとヘッダを作成（※スプレッドシート本体作成は[手順書](../../manuals/wbs-google-setup.md)ステップ 5、SA への共有はステップ 6＝**ユーザー手作業**、中身づくりは Claude）
  - 完了条件：列順が `wbs.config.yml` と一致。先頭列が WBS ID
- [x] **8.2** `Summary` にロールアップ数式を設置（フェーズ別・全体の進捗率）
  - 完了条件：`WBS` 更新時に数式で自動集計（US-8）。同期は数式を壊さない（✅ 総数/状態別件数/平均進捗。RAW保存に合わせ VALUE 変換で平均算出）

## フェーズ 9：セキュリティ・品質（WBS 9）

- [ ] **9.1** PII/秘密混入チェック（`wbs.yml`・`wbs.config.yml`・`.mcp.json` に PII/鍵がない）
  - 完了条件：開発タスクのメタ情報のみ（NFR-1）。`pre-commit-secret-scan` 通過（AC-5）
- [ ] **9.2** lint / typecheck / test を通す
  - 完了条件：`development-guidelines.md` §8 のフローが全て成功
- [ ] **9.3** （対話 MCP 利用時）`claude mcp add --scope project` で `.mcp.json` 登録（鍵は env 注入）
  - 完了条件：`.mcp.json` に秘密が含まれない

## フェーズ 10：永続ドキュメント反映（WBS 10）

> design §9 の影響範囲。**最小限**の追記に留める。

- [ ] **10.1** `docs/repository-structure.md` にトップレベル `wbs/` を追記
  - 完了条件：`wbs/` の役割・配置ルールが反映
- [ ] **10.2** `docs/development-guidelines.md` に WBS 同期の運用（自動トリガ＋確認ゲート）を追記
  - 完了条件：運用とフック方針が簡潔に記載
- [ ] **10.3** `docs/glossary.md` に用語追記（WBS / WBS ID / Sheets ビュー / Bolt / status 語彙）
  - 完了条件：コード・Sheets・docs で表記が一致

## フェーズ 11：受け入れ確認（WBS 11）

- [ ] **11.1** 受け入れ条件 AC-1〜AC-7（+2b）を一通り確認
  - 完了条件：下表の全 AC が満たされることを確認
- [ ] **11.2** 合成 WBS で end-to-end（編集→検知→提案→承認→反映）を実演
  - 完了条件：自動トリガ〜Sheets 反映が通しで動作

---

## 受け入れ条件トレーサビリティ

| AC | 内容 | 主担当タスク |
|---|---|---|
| AC-1 | spec が標準 WBS 一式を表現 | 2.1 |
| AC-2 | トリガ/指示→承認→Sheets 反映 | 5.2 / 6.1 / 7.3 |
| AC-2b | 承認まで書き込まない・拒否で書かない | 5.4 / 6.1 |
| AC-3 | 冪等（重複行なし） | 3.3 / 5.3 |
| AC-4 | 書き込み前に差分提示・承認 | 6.2 |
| AC-5 | PII/秘密の非混入（スキャン通過） | 9.1 |
| AC-6 | 認証情報を含めない（gitignore/example ダミー） | 1.5 |
| AC-7 | spec 更新がコミットされ差分追跡可 | 全般（Git 運用） |

---

## 進捗サマリ

| フェーズ | タスク数 | 完了 | 状態 |
|---|---|---|---|
| 1 準備・環境 | 5 | 5 | ✅ 完了 |
| 2 spec・設定 | 3 | 2 | 進行中（2.3 保留） |
| 3 差分ロジック | 3 | 3 | ✅ 完了 |
| 4 Sheets I/O | 2 | 2 | ✅ 完了 |
| 5 同期スクリプト | 4 | 3 | 進行中（5.4 は 6 と一緒に） |
| 6 確認ゲート | 2 | 0 | 未着手 |
| 7 自動トリガ | 4 | 0 | 未着手 |
| 8 Sheets 初期 | 2 | 2 | ✅ 完了 |
| 9 セキュリティ・品質 | 3 | 0 | 未着手 |
| 10 docs 反映 | 3 | 0 | 未着手 |
| 11 受け入れ確認 | 2 | 0 | 未着手 |
| **合計** | **33** | **17** | **進行中（コア疎通済み）** |

> 進捗の更新時はチェックボックスと本サマリを同時に更新する。tasklist が全完了に達した時点が、本機能の自動トリガ（Bolt 完了）の発火条件にあたる（design §5.3）。
> **ライブ進捗の正本は `wbs/wbs.yml`**（スプレッドシートへ同期）。本タスクリストは作業計画として維持する。
