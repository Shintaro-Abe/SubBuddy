---
name: quantitative-recommendation-engine
description: 定量レコメンドエンジン設計。5つの手段（契約事実・起動シグナル・知識ベース・初回1問・契約期間）でスコアリングし継続/様子見/解約を判定。現在方針では Shortcuts 由来の起動シグナルを iPhone アプリに吸収
metadata:
  type: project
  originSessionId: quantitative-rec-2026-06-08
---

定量レコメンドエンジンの設計が完了（2026-06-08）。成果物：`research/20260608-quantitative-recommendation-engine/investigation.md`。

**核心**：SubBuddyが「継続/様子見/解約」のレコメンドを定量的に判断して出す。5つの手段で解約スコア（0〜100点）を算出。

**5つの手段**：
1. 契約事実（料金・更新日・重複・カテゴリ）→ 基盤スコア
2. 起動シグナル（アプリ起動回数・最終起動日。現在方針では iPhone アプリに吸収）→ 利用有無の補助データ
3. サービス知識ベース（代替・無料プラン・ダウングレード先）→ 具体的な提案
4. 初回登録時の1問（「なくなったら困るか」）→ 価値の初期信号
5. 契約期間の長さ（登録日から自動算出）→ 惰性更新リスク

**判定閾値**：65点以上=解約検討、40〜64点=様子見、39点以下=継続

**起動シグナル実装の重要確認事項**：
- 当時のローカルMVP案では Shortcuts から直接 API サーバに HTTP POST する想定だった
- 現在の TestFlight 方針では、Shortcuts 由来の起動シグナルをネイティブ iPhone アプリに吸収し、外部ショートカット設定を v1 の主経路にしない
- サブスクIDとサブスク名の紐付けは既存の subscriptions テーブルで完結
- 既存の `ios_shortcut` ソース値は互換のため残す

**Shortcuts不在時の解約条件**：代替より50%割高 AND 重複2件以上 AND 契約12ヶ月以上 AND 年間節約¥10,000以上（全AND。1つでも欠ければ様子見止まり）

**ステアリング承認済み（2026-06-09）**：
- `.steering/20260609-quantitative-recommendation-engine/requirements.md` — 承認済み
- `.steering/20260609-quantitative-recommendation-engine/design.md` — 承認済み
- `.steering/20260609-quantitative-recommendation-engine/tasklist.md` — 承認済み（10フェーズ・45タスク）

**設計の進化（調査時点からの変更）**：
- 抽象的スコアリング（0〜100点）→ 具体的パターン判定（P1〜P7）に転換
- P1（使っていない）は方式C（スパン内利用日数＋最終利用経過日数の両方）を採用。判定スパンは月額=30日、年額=365日
- `usage_type`（active_foreground/active_background/active_other_device/passive/entitlement/capacity）で P1 適用可否を切り替え
- 無料プランは料金比較対象から除外（有料プラン同士のみ比較）
- iPhone前面利用アプリは DeviceActivity（iOS利用量）で計測。背景利用は iPhone アプリに吸収した起動シグナルで補助。受動/権利保有はP1適用不可

**実装完了（2026-06-09）**：全10フェーズ・45タスク完了。コミット `18aa33b`（feat(scoring): パターン判定方式に転換）＋ `1f81cd0`（README.md）を main にプッシュ済み。WBS 同期済み（RE-1〜RE-10 全完了）。ユニットテスト57件・E2E 6件・lint・typecheck 全通過。docs/（product-requirements・functional-design・glossary・architecture・repository-structure・development-guidelines）改訂済み。

**作業会プラン A〜D 完了（2026-06-11）**：main にプッシュ済み（`7e2b44d` seed/E2E、`937cfe9` API認証、`2b470e9` WBS）。WBS は RE-11〜RE-11.3 をシート同期済み。
- A. seed に Dropbox（passive）・Amazonプライム（entitlement）・Netflix（matchedServiceId 付き・プレミアム¥2,290）を追加。既存の音楽系は active_background、iCloud+ は capacity に整合。判定確認済み：passive/entitlement は P1 適用外で keep、Netflix は P3（広告つきスタンダード¥790）＋P4（Prime Video ¥600）→ consider_cancel
- B. E2E 2件追加（passive に P1 が出ない／ダウングレード提案が出る）。全 8 件通過
- C. `POST /api/usage/daily` に事前共有トークン認証を実装。環境変数 `USAGE_SYNC_TOKEN` を `Authorization: Bearer` で検証（`src/lib/usage-auth.ts`、timingSafeEqual・未設定時フェイルクローズ 401）。Shortcuts 設定用 QR にトークンを同梱。`.env.example` ダミー追記・functional-design §10.1 明記。テスト 66 件通過
- D. コミット・WBS 同期完了

**観測中バグ修正済み（2026-06-11、`779b0ae`）**：利用データゼロのサブスクが「観測中」にならず ready/keep に確定していた。原因は observing 分岐に設計（§8.5・design.md の時間ベース dataStatus）にない `hasUsageData` 条件が混入していたこと。条件を削除し、「データなし・観測期間内→observing」「passive は即時確定」のユニットテストで固定。残論点：登録14日超で計測未設定の能動サブスクは ready/keep（confidence 0.5）になり「計測していないだけ」と区別がつかない（「計測未設定」表示は新規の設計判断として未着手）。

**スコープ外（先送り確定）**：iOS DeviceActivity 実装（iOS Spike 別ステアリング・design.md 未承認）／API サーバのクラウド化／Gemini 料金月次チェックバッチ／LLM 自然文生成。

**Why:** 利用量ベース判定は業界前例ゼロ・計測が構造的に不正確（[[usage-recommendation-validity-research]]）。パターン判定方式に転換。
**How to apply:** 作業会プラン A〜D は完了。次に触れる候補：①「利用データなし＝観測中にならない」観察の扱い確認、②スコープ外リスト（iOS Spike・クラウド化・料金チェックバッチ・LLM 文面生成）からの優先度判断。
