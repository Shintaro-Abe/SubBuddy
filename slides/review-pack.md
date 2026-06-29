# レビューパック — 道場中間発表スライド（spec駆動＋Napkin＋Google Slides）

## 区分

- [x] 軽量（新規ワークストリームだが `docs/`・アプリコードに触れない。MCP導入＋steering＋手順書のみ）
- [ ] フル

> 補足: 設計の妥当性は本セッションのグリル（grilling）で stress-test 済み。グリルは承認された第二意見手段の一つ。重大な前提誤り（Napkin申請メール必須）をグリル中に公式裏取りで訂正済み。

## 対象ドキュメント

- 要求: [requirements.md](./requirements.md)
- 設計: [design.md](./design.md)
- タスク: [tasklist.md](./tasklist.md)
- 手順書: [setup/setup-google-slides-mcp.md](./setup/setup-google-slides-mcp.md) / [setup/setup-napkin-mcp.md](./setup/setup-napkin-mcp.md)

## トレーサビリティ表

| 受け入れ条件 | 設計要素 | タスク | 状態 |
|---|---|---|---|
| AC-1 Slides MCPビルド＋登録＋呼出可 | Slides MCP自前ホスト構築、`.mcp.json`追記 | T-4 | 手順書化済（実行は認証後） |
| AC-2 Slides MCP認証手順の文書化 | setup-google-slides-mcp.md | T-1 | 完了 |
| AC-3 Napkin MCP登録＋verify成功 | Napkin MCP登録、`.mcp.json`追記 | T-6 | 手順書化済（実行は契約後） |
| AC-4 Napkin有料＋トークン手順の文書化 | setup-napkin-mcp.md | T-2 | 完了 |
| AC-5 spec一式作成（talk-draft整合） | briefing/outline/slide-spec | T-7,T-8,T-10 | 未着手（認証後） |
| AC-6 art-direction が DESIGN.md と整合 | art-direction（Serene Capital由来） | T-9 | 未着手（認証後） |
| AC-7 デッキ生成＋図版埋め込み | Napkin生成→Slides埋め込み | T-11,T-12 | 未着手（認証後） |

> 漏れ・孤立の有無: なし。全ACに設計要素とタスクが対応。本セッションスコープ（T-1,T-2）は完了。

## 前提・未決事項

### 要ユーザー判断（承認前に解消）

- [x] Q-1: 3ツールの役割分担 → AWS手法借用＋Slides MCP直接＋Napkin図版のみ（解消）
- [x] Q-2: コンテンツ出所 → talk-draft 下敷きに再設計（解消）
- [x] Q-3: 作業順序 → 認証取得を先に（解消）
- [x] Q-4: Slides MCP実装 → ryanvo162（39ツール・自前ホスト）（解消）
- [x] Q-5: デザイン基準 → 静謐なエディトリアル（DESIGN.md統一）（解消）
- [x] Q-6: Napkin扱い → 通常スコープ（承認待ち不要と判明）（解消）
- [x] Q-7: 透かし対策 → 最初から有料プラン（解消）

### 設計上の前提（崩れると設計が変わるもの）

- 前提: PII不掲載 / ローカルファースト（Slides自前ホスト）/ しきい値は実装値が正 / DESIGN.md が唯一の源。
- 外部依存リスク: Napkin API は developer preview（破壊的変更あり得る）。MCPは双方とも非公式/OSS。

## 影響範囲

- `docs/` への影響 / 更新案: なし。
- 既存コード・機能への影響: なし（`.mcp.json` 追記のみ、`apps/web` 不変）。
- マイグレーション・後方互換: 不要。

## セルフレビュー結果

| 観点 | 指摘 | 対応 |
|---|---|---|
| PM | 3ツールが噛み合わない（pptx vs 部品 vs 器） | 役割分担で composes（手法借用＋直接構築＋部品埋込） |
| アーキ | マネージド型は第三者経由でローカルファースト違反 | 自前ホスト（Google直）を採用 |
| QA | 「Napkin申請必須」の出典が非公式READMEのみ | 公式（help/api.napkin.ai）で裏取り→セルフサービスと判明、訂正 |
| セキュリティ/プライバシー | OAuthトークン・APIキー・credentials.jsonの流出 | 全て env / リポジトリ外 / `.gitignore`、コミット禁止を明記 |
| QA | スライドへの実データ混入リスク | 合成データのみ・完了チェックにPII確認を追加 |

### 第二意見

- 手段: grilling（本セッションの対話）
- 要点: ツールチェーンの非整合を最初に表面化／Napkin申請メールの要否をクリティカルに再チェック→公式裏取りで前提誤りを訂正。
- 反映: 役割分担の確定、Napkinを保留解除、申請メール文面を廃止しトークン発行手順に差替。

## 承認

- [x] 未決事項ゼロを確認
- [x] トレーサビリティ表に漏れ・孤立なし
- [x] requirements / design / tasklist をまとめて承認（ユーザー「進める」で承認済み）
