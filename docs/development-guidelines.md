# 開発ガイドライン（Development Guidelines）

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：永続的ドキュメント（`docs/`）
> 最終更新：2026-06-02
> 関連：`architecture.md`（技術仕様）、`repository-structure.md`（構成）、`functional-design.md`（機能設計）、`glossary.md`（用語）

---

## 1. 本書の位置づけ

本書は SubBuddy 開発における **コーディング規約・命名規則・スタイリング規約・テスト規約・Git 規約** を定義する。
コードの一貫性・可読性・安全性を機械的に担保することを目的とし、ESLint / Prettier 等で**自動強制できる規約を優先**する。

前提（他ドキュメントから継承）：

- **PII・秘密情報を扱わない**：実データを参照・生成・コミットしない。合成データのみ（`CLAUDE.md`）。
- **ドメイン分離**：判定ロジックは `src/domain/` に集約、UI/API に散在させない（`architecture.md` §7）。
- **検証境界の一元化**：外部入力は Zod で検証してからドメインへ渡す（`architecture.md` §5.1 / §8.3）。

> 言語・ツールの**バージョン具体値は固定しない**。`package.json` / `.tool-versions` を一次情報とする（陳腐化防止）。

---

## 2. コーディング規約（共通）

- **型安全を最優先**：TypeScript は `strict` を有効化。`any` は原則禁止（やむを得ない場合は理由をコメントし `unknown` + 絞り込みを優先）。
- **早期リターン**でネストを浅く保つ。1 関数は 1 責務。
- **副作用の分離**：純粋なドメインロジック（計算・判定）と I/O（DB・ネットワーク）を分ける。ドメイン関数は副作用を持たない。
- **マジックナンバー禁止**：スコアリング閾値等は `src/config/` に外出し（`architecture.md` §6）。
- **コメントは「なぜ」を書く**：何をしているかはコードで表現し、意図・背景・トレードオフをコメントに残す。
- **エラーハンドリング**：握りつぶさない。失敗は型（例：`Result` 風）か例外で明示し、ユーザー向けメッセージに内部情報・PII を含めない。
- **依存方向**：`components / app → domain → repositories`。逆流させない。ドメインから Prisma を直接呼ばない。

### セキュリティ（必須）

- **入力は信頼しない**：API・取り込みペイロード・フォーム入力はすべて Zod で検証（`src/schemas/`）。
- **XSS 対策**：ユーザー入力をそのまま DOM へ挿入しない。`dangerouslySetInnerHTML` は原則禁止。
- **秘密情報をコードに書かない**：トークン・資格情報は環境変数（`.env`、`.gitignore` 済）。`.env.example` はダミー値のみ。
- **ログに PII・秘密情報を出力しない**。エラーログも同様。
- **金額は整数（最小通貨単位）**で扱い、浮動小数で保持しない（`architecture.md` §5）。

---

## 3. 命名規則

### 3.1 TypeScript（Mac 側）

| 対象 | 規則 | 例 |
|---|---|---|
| 変数・関数 | camelCase | `costPerUsageDay`、`computeScore()` |
| 型・インターフェース・クラス | PascalCase | `Subscription`、`UsageSummary` |
| 定数（真の不変値） | UPPER_SNAKE_CASE | `DEFAULT_CURRENCY` |
| ファイル（実装） | kebab-case | `scoring-rules.ts`、`gym-visit-connector.ts` |
| React コンポーネント | PascalCase（ファイルも） | `SubscriptionCard.tsx` |
| Zod スキーマ | `xxxSchema` | `usageSummarySchema` |
| ディレクトリ | kebab-case | `gym-visit/`、`billing-email/` |

- **ドメイン用語は `glossary.md` の英日対応表に従う**。コード上の命名とビジネス用語を一致させる（例：`recommendation`、`billingEvent`）。
- 真偽値は `is/has/should` 接頭辞（例：`isApproximate`、`hasActiveSubscription`）。
- コネクタ名は**取得源**を表す（`screen-time` / `icloud` / `gym-visit` / `billing-email`）。共通モデルの軸名（time/capacity/visit）と混同しない。

### 3.2 Swift（iPhone 側）

- 型：UpperCamelCase、プロパティ・メソッド：lowerCamelCase（Swift API Design Guidelines に準拠）。
- ドメイン用語は TypeScript 側と意味を一致させる（`glossary.md` 準拠）。

### 3.3 DB（Prisma / PostgreSQL）

- テーブル名：複数形 snake_case（`subscriptions`、`billing_events`）。カラム：snake_case。
- 既存定義（`functional-design.md` §5）に従い、全テーブルに `user_id` を持たせマルチテナント対応を維持。

---

## 4. スタイリング規約（UI）

- **Tailwind CSS を共通デザインシステムとして使用**し、統一感を保つ（要求 14）。
- 任意の生 CSS・インラインスタイルは原則使わない。色・余白・タイポはユーティリティクラスに統一。
- 繰り返すパターンは**コンポーネント化**して再利用（`src/components/`）。クラス文字列の重複を避ける。
- レスポンシブはモバイル優先（必要に応じてブレークポイント）。
- アクセシビリティ：意味のある要素（`button`/`a`/見出し階層）を用い、`alt`・ラベルを付与。

---

## 5. テスト規約

- **Vitest を中心に、ドメインロジック（スコアリング・正規化）を単体テスト**で担保する（`architecture.md` §3.1）。
- **合成データのみ**：fixture・seed・スナップショットに実 PII を使わない（`CLAUDE.md`）。
- **テスト対象の優先度**：①スコアリング判定（keep/review/…）、②段階的提供の境界（観測中⇄確定＝`minObservationDays` の前後）、③利用量の正規化、④Zod スキーマ境界、⑤冪等 upsert。
- 純粋関数はモック不要で入出力検証。I/O はリポジトリをモック。
- 閾値変更の影響はテストで固定（`config` の値を流し込み、判定差分を検証）。
- E2E（Playwright）は任意。主要導線（サブスク登録 → 一覧 → レコメンド表示）に限定。

---

## 6. Git 規約

### 6.1 ブランチ

- `main` は常に動作可能を保つ。作業は**フィーチャーブランチ**を切る。
- ブランチ名：`<type>/<short-desc>`（例：`feat/ingestion-connectors`、`fix/score-threshold`）。

### 6.2 コミットメッセージ

- **Conventional Commits** 形式：`<type>(<scope>): <subject>`。
  - type：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style`。
  - 例：`feat(ingestion): add screen-time connector`、`docs: repository-structure 初版`。
- 件名は命令形・簡潔に。本文に「なぜ」を書く。
- **1 コミット 1 論理変更**。無関係な変更を混ぜない。

### 6.3 コミット前チェック（必須）

1. **リント・型チェック・テストを通す**（`lint` / `typecheck` / `test`）。`CLAUDE.md`：コード変更後は必ず実施。
2. **シークレットスキャンを実行**し、秘密情報・PII の混入がないことを確認してからコミットする。
3. `.env`・実データ・ビルド成果物が**ステージされていない**ことを確認（`.gitignore` で除外）。

### 6.4 禁止事項

- 実 PII・秘密情報・本番 DB ダンプの**コミット禁止**。
- `main` への直接の破壊的操作（force push 等）は避ける。
- レビュー・承認なしの大規模設計変更を `docs/` に対して行わない（`CLAUDE.md` の段階承認プロセスに従う）。

---

## 7. ドキュメント更新規約

- 基本設計に影響する変更は、該当する `docs/` を**同時に更新**する（コードとドキュメントの乖離を防ぐ）。
- 図表は変更時に対応する Mermaid も更新する。
- 作業は `.steering/[YYYYMMDD]-[タイトル]/` に requirements → design → tasklist の順で起こし、各段階で承認を得る（`CLAUDE.md`）。

---

## 8. WBS 進捗管理の運用（自動トリガ＋確認ゲート）

開発タスクの進捗は WBS で管理し、**正本はリポジトリの `wbs/wbs.yml`**、Google スプレッドシートはその生成ビュー（片方向同期：spec → Sheets）とする。構成は `repository-structure.md` §6 を参照。

### 8.1 基本原則

- **正本は `wbs/wbs.yml` のみ**。進捗が変わったら、まず `wbs.yml` を編集してコミットする。スプレッドシートを手で直しても、次回同期で正本に上書きされる。
- **片方向**：同期は spec → Sheets の一方向。Sheets から spec への逆流は行わない。
- **冪等**：同じ `wbs.yml` を二度同期しても結果は変わらない（重複行を作らない）。
- WBS に書くのは**開発タスクのメタ情報のみ**。エンドユーザーの PII・機微データを書かない（`CLAUDE.md`）。

### 8.2 同期の流れ（確認ゲート）

書き込み前に必ず差分を提示し、**ユーザーの承認を得てから反映**する（承認なしには書き込まない）。

```
wbs.yml 編集 → dry-run（差分のみ表示・無書き込み） → 差分を提示
            → ユーザー承認（AskUserQuestion） → 承認時のみ apply（Sheets へ反映）
```

- 起動は `/wbs-sync` コマンド（`.claude/commands/wbs-sync.md`）。`npm --prefix wbs run sync`（既定 dry-run）→ 差分があれば確認 → `npm --prefix wbs run sync:apply`。
- spec から消えたタスクは `Archive` シートへ退避してから `WBS` から除去する（履歴を残す）。

### 8.3 自動トリガ

- `.steering/*/tasklist.md` のチェックボックスが**全完了**になった編集を `PostToolUse` フック（`wbs/scripts/detect-bolt-complete.mjs`）が検知し、Claude に同期を提案する（提案のみ。書き込みは確認ゲートを必ず通る）。
- 同一完了状態での重複提案は抑止する（`wbs/.sync-state.json` にハッシュ記録。gitignore 対象）。
- 手動でも同じオーケストレータ（`/wbs-sync`）を起動できる。

### 8.4 認証・秘密情報

- Sheets へのアクセスは公式 Workspace CLI（`gws`）を**サービスアカウント（SA）方式**で使う。SA 鍵は `secrets/` に置き、`wbs/.env` の `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` で指定する。
- **鍵・`.env` はコミットしない**（`.gitignore` / `.gitleaks.toml` で担保）。`wbs.config.yml` には非秘密のみ。
- Google 側の初期設定（プロジェクト・API 有効化・SA 作成・シート共有）は人手の作業で、手順書は `manuals/wbs-google-setup.md`。

---

## 9. 品質チェックの基本フロー

```
実装 → lint / typecheck → 単体テスト → シークレットスキャン → コミット → （必要に応じて）E2E
```

- いずれかが失敗した場合は**先に進まない**。失敗内容は隠さず共有する。
