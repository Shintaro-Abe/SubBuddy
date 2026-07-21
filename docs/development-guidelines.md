# 開発ガイドライン（Development Guidelines）

> プロジェクト名 / アプリ名：**SubBuddy**
> ドキュメント種別：永続的ドキュメント（`docs/`）
> 最終更新：2026-07-21（iPhone共通操作スタイルと文書現行性検査を反映）
> 関連：`architecture.md`（技術仕様）、`repository-structure.md`（構成）、`functional-design.md`（機能設計）、`glossary.md`（用語）

---

## 1. 本書の位置づけ

本書は SubBuddy 開発における **コーディング規約・命名規則・スタイリング規約・テスト規約・Git 規約** を定義する。
コードの一貫性・可読性・安全性を機械的に担保することを目的とし、ESLint / Prettier 等で**自動強制できる規約を優先**する。

前提（他ドキュメントから継承）：

- **PII・秘密情報を扱わない**：実データを参照・生成・コミットしない。合成データのみ（`AGENTS.md`）。
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
- **テナント分離を崩さない**：API / repository は認証済み `user_id` で必ず絞り込む。クライアント指定の `userId` を信じない。
- **デバイス同期トークンを平文保存しない**：DB にはハッシュのみ保存し、ログ・エラー・テスト出力に平文トークンを残さない。
- **local mode と cloud mode の差分を境界に閉じ込める**：認証 provider、DB 接続先、URL/TLS、secret 管理以外に実行モード差分を広げない。

---

## 3. 命名規則

### 3.1 TypeScript（Mac 側）

| 対象 | 規則 | 例 |
|---|---|---|
| 変数・関数 | camelCase | `computeRecommendation()`、`matchedPatterns` |
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
- 画面はルート状態、機能別View、状態・API境界、表示モデル、デザイントークンを分離する。API URLや内部IDを利用者入力にしない。
- PreviewとXCTestには合成データだけを使い、実在の契約・金額・Apple識別子・端末IDを含めない。

### 3.3 DB（Prisma / PostgreSQL）

- テーブル名：複数形 snake_case（`subscriptions`、`billing_events`）。カラム：snake_case。
- 既存定義（`functional-design.md` §5）に従い、全テーブルに `user_id` を持たせマルチテナント対応を維持。

---

## 4. スタイリング規約（UI）

- Webは**Tailwind CSSを共通デザインシステムとして使用**し、色・余白・タイポをユーティリティクラスへ揃える（要求14）。任意の生CSS・インラインスタイルは原則使わない。
- iPhoneはWeb版の色・余白・情報の強弱・中立トーンをSwiftUI用デザイントークンへ対応付ける。SwiftUI標準操作、Dynamic Type、VoiceOverを優先し、WebのCSSや配置をそのまま移植しない。
- iPhoneの通常操作色、塗りつぶしボタン文字色、Apple公式ボタン寸法は`DesignSystem.swift`の共通定義を使う。ダークモードで固定アクセント色を直接指定せず、削除・警告・状態・グラフ等の意味色とは分離する。
- 書体はWeb版を正本とし、iPhoneの本文・見出しは`Zen Kaku Gothic New`、大見出しは`Shippori Mincho`、金額・主要数値は`BIZ UDPGothic`へ対応付ける。`Font.custom(..., relativeTo:)`でDynamic Typeを維持し、フォントファイルとOFLライセンスは`SubBuddyApp/Resources/`で一緒に管理する。
- 繰り返すパターンは**コンポーネント化**して再利用（`src/components/`）。クラス文字列の重複を避ける。
- レスポンシブはモバイル優先とし、端末名・ブラウザ名・User-Agentで専用画面を分岐しない。iPhone横向きを含む1023px以下はコンパクトシェル、1024px以上は左サイドバーを基準とする。
- Web変更時は320px、375px、390px、430px、iPhone横向き、1024px以上を確認し、ページ全体の横スクロールを許容しない。固定ナビは`env(safe-area-inset-*)`と本文余白を組み合わせ、ホームバー、ブラウザツールバー、ソフトウェアキーボードと重ねない。
- Webの入力文字は16px以上、主要操作は44px以上とする。視覚順だけをCSSの`order`で変えず、DOM順・キーボード順・読み上げ順を一致させる。
- アクセシビリティ：意味のある要素（`button`/`a`/見出し階層）を用い、`alt`・ラベルを付与。

---

## 5. テスト規約

- **Vitest を中心に、ドメインロジック（スコアリング・正規化）を単体テスト**で担保する（`architecture.md` §3.1）。
- **合成データのみ**：fixture・seed・スナップショットに実 PII を使わない（`AGENTS.md`）。
- **テスト対象の優先度**：①スコアリング判定（keep/review/…）、②段階的提供の境界（観測中⇄確定＝`minObservationDays` の前後）、③利用量の正規化、④Zod スキーマ境界、⑤冪等 upsert。
- 純粋関数はモック不要で入出力検証。I/O はリポジトリをモック。
- 閾値変更の影響はテストで固定（`config` の値を流し込み、判定差分を検証）。
- 開発中のPlaywright E2Eは変更リスクに応じて実施する。リリースゲートで指定されたWeb主要導線・対応ブラウザのE2Eは必須とし、「任意」にはしない。
- 新しい独立した品質確認を始める前に`.audit/test-status.md`へ対象と状態「実施中」を記録し、終了後に結果と未確認範囲を同じ行へ反映する。
- iPhone UIの基本回帰はMacで`apps/ios/scripts/verify-main-ui.sh`を実行する。Simulator buildと単体テストだけで、実機API結合、Screen Time、VoiceOver、画面サイズ、性能の確認を代替しない。

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

1. **リント・型チェック・テストを通す**（`lint` / `typecheck` / `test`）。`AGENTS.md`：コード変更後は必ず実施。
2. **シークレットスキャンを実行**し、秘密情報・PII の混入がないことを確認してからコミットする。
3. `.env`・実データ・ビルド成果物が**ステージされていない**ことを確認（`.gitignore` で除外）。

### 6.4 禁止事項

- 実 PII・秘密情報・本番 DB ダンプの**コミット禁止**。
- `main` への直接の破壊的操作（force push 等）は避ける。
- レビュー・承認なしの大規模設計変更を `docs/` に対して行わない（`AGENTS.md` の段階承認プロセスに従う）。

---

## 7. ドキュメント更新規約

- 基本設計に影響する変更は、該当する `docs/` を**同時に更新**する（コードとドキュメントの乖離を防ぐ）。
- 図表は変更時に対応する Mermaid も更新する。
- 作業は `.steering/[YYYYMMDD]-[タイトル]/` に requirements → design → tasklist の順で起こし、レビューパックでまとめて承認を得る（`AGENTS.md`）。
- 仕様の正本は`docs/`、現在の進捗は`wbs/wbs.yml`と対象作業の`tasklist.md`、テスト結果は`.audit/test-status.md`とする。日付付き`.steering/`と`obsidian/`は履歴であり、後続文書が上書きした前提は現行仕様として使わない。
- 古いステアリング本文は当時の判断記録として保持する。現行方針との違いは`.steering/README.md`または文書冒頭の状態注記で明示し、過去の承認内容を無言で書き換えない。
- 文書を現行実装へ同期するときは、実装コード・DBスキーマ、`.audit/test-status.md`、後続の承認済みステアリングの順に照合する。「実装済み」「対象環境で検証済み」「配布可能」を混同しない。
- `manuals/`はMarkdownを正本とし、内容を変更したら`procedure-guide`の変換器で対応HTMLを再生成する。HTMLだけを手編集しない。

---

## 8. WBS 進捗管理の運用（自動トリガ＋確認ゲート）

開発タスクの進捗は WBS で管理し、**正本はリポジトリの `wbs/wbs.yml`**、Google スプレッドシートはその生成ビュー（片方向同期：spec → Sheets）とする。構成は `repository-structure.md` §6 を参照。

### 8.1 基本原則

- **正本は `wbs/wbs.yml` のみ**。進捗が変わったら、まず `wbs.yml` を編集してコミットする。スプレッドシートを手で直しても、次回同期で正本に上書きされる。
- **片方向**：同期は spec → Sheets の一方向。Sheets から spec への逆流は行わない。
- **冪等**：同じ `wbs.yml` を二度同期しても結果は変わらない（重複行を作らない）。
- WBS に書くのは**開発タスクのメタ情報のみ**。エンドユーザーの PII・機微データを書かない（`AGENTS.md`）。

### 8.2 同期の流れ（確認ゲート）

書き込み前に必ず差分を提示し、**ユーザーの承認を得てから反映**する（承認なしには書き込まない）。

```
wbs.yml 編集 → dry-run（差分のみ表示・無書き込み） → 差分を提示
            → ユーザー承認（Codex の確認ゲート） → 承認時のみ apply（Sheets へ反映）
```

- 起動は `wbs-sync` Skill または WBS 同期スクリプトで行う。`npm --prefix wbs run sync`（既定 dry-run）→ 差分があれば確認 → `npm --prefix wbs run sync:apply`。
- spec から消えたタスクは `Archive` シートへ退避してから `WBS` から除去する（履歴を残す）。

### 8.3 自動トリガ

- `.steering/*/tasklist.md` のチェックボックスが**全完了**になった編集を `PostToolUse` フック（`wbs/scripts/detect-bolt-complete.mjs`）が検知し、エージェントに同期を提案する（提案のみ。書き込みは確認ゲートを必ず通る）。
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

---

## 10. リリースゲートと証跡

### 10.1 3段階の管理

- リリース進捗は「社内実機確認」「TestFlight小規模検証」「一般公開」に分ける。TestFlight配信を一般公開完了とは扱わない。
- 各段階に開始条件、完了条件、中止・差し戻し条件、証跡、担当区分を持たせる。
- 実装済み、対象環境で検証済み、配布可能を別状態として記録する。コードが存在するだけでは完了にしない。
- 一般公開日はTestFlight終了レビュー後にだけ設定する。

### 10.2 WBS進捗

- 親タスクの進捗は子タスクと証跡から算出し、手入力の印象値にしない。
- 旧計画のIDは削除・再利用しない。再基準化後の親へ移せない完了履歴は参照レーンとして残す。
- 後続タスクが完了していても、先行条件が未完了ならゲートを合格にしない。
- 日付は最短・標準・悲観の幅と再見積もり条件を持つ。圧縮不能な7日計測、審査、復元訓練を明示する。

### 10.3 必須証跡

- 合成データだけを使ったテスト結果、実機・ブラウザの画面確認、Archive/署名/entitlement、復元訓練、削除一気通貫、テナント分離、性能・アクセシビリティ、クラッシュ、費用監視を記録する。
- 実在ユーザーの契約、金額、利用量、メール、スクリーンショットを証跡へ含めない。
- Family Controls、App Store Connect、Render等の外部状態は確認日時と対象環境を記録する。

### 10.4 変更とロールバック

- DB変更は前進・後退手順、バックアップ、別環境復元、削除記録の再適用を確認してから配布する。
- 認証、削除、データ移行、競合解決、見直し計算の根幹変更は子ステアリングで再承認する。
- 重大事故時は新規参加と影響機能を停止する。閲覧、データ出力、完全退会、安全通知は可能な限り維持する。
- WBSの外部同期は必ずdry-run差分を提示し、ユーザー承認後だけ反映する。
