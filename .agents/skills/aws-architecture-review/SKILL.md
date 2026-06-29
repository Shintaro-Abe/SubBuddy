---
name: aws-architecture-review
description: >
  AWS Well-Architected の 6 ピラーで構成・コスト・セキュリティを
  サブエージェントに委任して総合レビューする。「AWS構成をレビュー」
  「アーキテクチャ監査」「/aws-review」など、ユーザーが明示的に依頼したときのみ起動
  （自動起動禁止）。結果は .audit/ に保存しサマリのみ親会話に返す。
---

# AWS Architecture Review

ユーザーが明示的にレビューを依頼したときに起動する。本エージェント（Codex CLI）の判断で自動起動してはならない。
実働は専用サブエージェント `aws-architecture-reviewer` に委任し、メインエージェントは
レビューを自分で実行しない（重い調査でメイン会話のコンテキストを汚さないため）。

依頼を受けたら AWS Well-Architected Framework の 6 ピラーに沿って総合レビューする。

---

## Step 1: 事前準備

### 1.1 対象 IaC の自動検出
1. ユーザー指定パスがあればそれを使う
2. なければ自動検出: SAM (`template.yaml` / `template.yml`) → CDK (`cdk.json` 起点に
   `lib/` `bin/` `infra/` の TS/Python ソース) → Terraform (`*.tf`) → CloudFormation
   (`AWSTemplateFormatVersion` を含む `*.yaml` / `*.json`)
3. 複数該当時はユーザーに確認、未検出時は中断

### 1.2 出力先
`.audit/<YYYY-MM-DD>_aws-architecture-review.md`（同日連番は `_2`, `_3`）。
`.audit/` がなければ `mkdir -p .audit`。

### 1.3 受容済みリスクの抽出
誤って Critical/High として再指摘されるのを防ぐため、既知の受容済みリスクを抽出する。
参照源（存在するものを順に確認）:

1. **auto-memory** — `feedback_*` / `project_*` のうち「却下済み」「受容済み」と明記されたもの
2. **AGENTS.md / docs/** — 設計判断記録の "受容済みリスク" セクション
3. **過去の `.audit/` レポート** — 直近の同種レポートの「受容済みリスク」欄

得られた項目は `項目名 — 受容理由` の形式で 1 行ずつ抽出。何もなければ空で良い。

### 1.4 AWS 認証の事前確認（必須ゲート）

このレビューは Security Hub findings の取得を含むため、有効な AWS 認証が必須。Bash で確認:

```bash
aws sts get-caller-identity
```

**成功した場合のみ Step 2 に進む。** 失敗した場合（`NoCredentialsError` / `ExpiredToken` /
`AccessDenied` / `Unable to locate credentials` 等）は**サブエージェントを起動せず**、
ユーザーに以下のメッセージを返して中断する:

```
AWS 認証が確認できませんでした。本レビューは Security Hub findings 取得のため
有効な AWS 認証が必須です。

プロンプトに以下を入力して認証してください:

! aws login

認証完了後、再度レビューを依頼してください。
```

ユーザーは `!` プレフィックスで `aws login` を実行できる。完了後にユーザーが再度依頼するまで待機する（自動再試行はしない）。

---

## Step 2: サブエージェントの起動

`Agent` ツールで `aws-architecture-reviewer` を呼ぶ。

```
description: AWS architecture review
subagent_type: aws-architecture-reviewer
prompt: |
  対象リポジトリ: <絶対パス>
  IaC タイプ: <SAM / CDK / Terraform / CloudFormation>
  対象パス: <Step 1.1 で特定したパス（複数可）>
  出力先: .audit/<YYYY-MM-DD>_aws-architecture-review.md

  受容済みリスク（指摘可、ただし "受容済み" タグを付け severity 昇格させない）:
  <Step 1.3 で抽出した項目を 1 行ずつ。なければ「なし」>

  プロジェクト固有の補足は IaC ファイル・README・docs/・auto-memory から
  サブエージェント自身が読み取って把握する。

  Step 3 のチェックリストと Step 4 の出力フォーマットに厳密に従い、
  指定パスに保存後、サマリ（指摘件数と総合評価）のみ親会話に返却。
```

---

## Step 3: レビュー観点（AWS Well-Architected 6 ピラー）

英語名は WA 公式（whitepaper トレース用）、カッコ内に日本語訳。
原則ベースの記述で AWS サービス名は例示にとどめる（多プロジェクト展開のため）。

### Operational Excellence（運用上の優秀性）
- **Prepare**: IaC 化・構成ドリフト検出、可観測性（ログ・メトリクス・トレース）、CI/CD・段階的ロールアウト・ロールバック手順、runbook
- **Operate**: アラーム（しきい値・通知経路）、タグ付け規約、ダッシュボード
- **Evolve**: 運用メトリクスの改善ループ（コード・ドキュメント上の痕跡で判定）

### Security（セキュリティ）
- **Identity & Access Management**: 最小権限、ワイルドカード（`*`）の使用箇所、ロール境界
- **Detection**: 監査ログ（例: CloudTrail）、脅威検知（例: GuardDuty）、通知連携
- **Infrastructure Protection**: パブリック露出最小化、SG/NACL/WAF の最小開放、エッジ保護
- **Data Protection**: 保存時・転送時暗号化、鍵ローテーション、データ分類
- **Application Security**: シークレット管理（直書き禁止）、依存ライブラリ脆弱性、入力検証
- **Incident Response**: 対応手順、一時認証情報の扱い、影響範囲特定の自動化

### Reliability（信頼性）
- **Foundations**: サービスクォータ余裕度、ネットワーク容量
- **Workload Architecture**: 疎結合・障害分離、ヘルスチェック・タイムアウト・リトライ・サーキットブレーカー、冪等性
- **Change Management**: カナリア / Blue-Green、自動ロールバック条件
- **Failure Management**: Multi-AZ/Region、自動バックアップ・PITR、DR ドリル痕跡、DLQ 等のエラー捕捉

### Performance Efficiency（パフォーマンス効率）
- **Architecture Selection**: ワークロードに適合したサービス選択
- **Compute & Hardware**: 適切サイズ・最新世代・ARM 採用、Auto Scaling 設定、コールドスタート対策（必要時）
- **Data Management**: パーティション・インデックス、読み書きパターン適合、階層化
- **Networking & Content Delivery**: CDN、リージョン配置・経路最適化
- **Process & Culture**: ベンチマーク・ボトルネック分析の習慣（ドキュメント上の痕跡で判定）

### Cost Optimization（コスト最適化）
- **Cloud Financial Management**: 予算アラーム、コスト配分タグ
- **Expenditure & Usage Awareness**: 課金ダッシュボード、異常コスト検知
- **Cost-Effective Resources**: リソースサイジング、課金モデル選択（On-Demand / Reserved / Savings Plans / Spot）、マネージド vs 自前、リージョン間・AZ 間データ転送
- **Manage Demand & Supply**: Auto Scaling 需要追従、開発環境の停止スケジュール
- **Optimize Over Time**: 古いスナップショット・未使用リソース棚卸し、ストレージ階層・ログ保持期間の見直し

### Sustainability（持続可能性）
- **Region Selection**: 低炭素リージョン
- **Alignment to Demand**: 非稼働時停止、ジョブ集約・バッチ化
- **Software & Architecture**: 過剰な層・無駄な計算の削減、効率的アルゴリズム
- **Data**: 不要データ削除、低頻度アクセスの階層移動
- **Hardware & Services**: 高効率インスタンス（ARM 等）、マネージドサービスへの移譲

### プロジェクト固有観点
上記は汎用チェックリスト。プロジェクト固有の重要観点はサブエージェントが
リポジトリ・README・docs/・auto-memory を読んで自律発見し、観点に追加する。

---

## Step 4: 出力フォーマット（サブエージェントが厳守）

```markdown
# AWS Architecture Review — YYYY-MM-DD

## サマリ
- Critical: N / High: N / Medium: N / Low: N / Info: N
- 総合評価: <3 行以内>
- 対象: <ファイルパス・スタック名>
- 使用ツール: <cfn-lint / cfn-guard / Security Hub / 公式 docs 等>

## 指摘事項

### [Critical] <タイトル>
- **カテゴリ**: <WA ピラー> / <サブ領域>
- **対象**: `<ファイルパス>:<行>` または リソース論理名
- **現状**: 事実のみ
- **リスク・影響**: 何が起きうるか
- **推奨**: 具体的な修正案（コードスニペット可）
- **根拠**: 公式ドキュメント URL / Security Hub finding ID / WA pillar

### [High] ... / [Medium] ... / [Low] ... / [Info] ...

## 受容済みリスク（参考）
- <項目> — <受容理由>

## 次アクション提案
（3〜5 項目、優先度順）
```

### Severity 基準
- **Critical**: 即時のセキュリティ侵害・データ漏洩・本番停止リスク
- **High**: 近い将来に問題化／ベストプラクティスの重大違反
- **Medium**: 改善推奨だが緊急性は低い
- **Low**: 軽微／好みの範疇
- **Info**: 気付きの共有

---

## Step 5: メイン会話への返却

サブエージェントから返却されたサマリのみユーザーに表示し、保存先パスを案内する。
詳細はメイン会話に貼り付けない（コンテキスト隔離の意義を損なうため）。
