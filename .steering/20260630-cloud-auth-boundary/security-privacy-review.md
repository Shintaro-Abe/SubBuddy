# セキュリティ・プライバシーレビュー

> 対象: 小規模検証版に向けた実行モード・認証境界・クラウド保存範囲。

## 結論

現時点の方針は、SubBuddy の PII 方針と整合している。ただし、クラウド化によってローカルMVPより管理責任が大きくなるため、実装時はテナント分離・同期トークン・ログ出力・削除導線を必須ゲートとして扱う。

## 指摘と対応

| 観点 | リスク | 対応 |
|---|---|---|
| テナント分離 | `user_id` をクライアント入力から信じると、他ユーザーのデータへ書き込める | session / device token から `user_id` を解決し、body の `userId` は使わない |
| 同期トークン | device token を平文保存すると漏えい時の被害が大きい | token はハッシュ保存し、失効・再発行可能にする |
| ログ | token、Apple identifier、メール、詳細利用情報がログに残ると機微情報漏えいになる | 認証値・識別子・詳細データをログに出さない。エラーは抽象化する |
| 保存範囲 | クラウドに詳細ログや生データを保存すると説明責任が重くなる | MVP中核データ、集計値、レコメンド結果、token hash までに限定する |
| iPhone利用量 | Screen Time の詳細ログや全アプリ一覧を送ると方針違反になる | iPhone から送るのは日別・サブスク単位の集計値のみ |
| Apple サインイン | メールアドレスを主キー扱いすると非公開メールや変更に弱い | Apple 側 stable identifier と SubBuddy user を紐づける。メールは補助情報にする |
| 削除導線 | クラウド保存後に削除できないと信頼を損なう | 小規模検証版でもアカウント削除・デバイス失効・データ削除方針を用意する |
| Shortcuts | 未検知を未使用と断定すると誤判定になる | Shortcuts は recency 補助に限定し、未検知を強い解約根拠にしない |
| local/cloud 差分 | local だけ安全に見えて cloud で壊れる | 同一 schema / API / domain を使い、差分を provider/env に閉じ込める |

## 実装時の必須テスト

- user A の Web session で user B の subscription を読めない。
- user A の device token で user B の subscription に usage を送れない。
- revoked token は 401 になる。
- token なし・誤 token は 401 になる。
- subscription 所有者不一致は 404 または 403 になる。
- logs に token、Apple identifier、メールアドレス、詳細利用情報が残らない。
- local mode の `user_local` フローが壊れない。

## 実装時に再確認する外部仕様

- Apple サインインの最新実装要件。
- Family Controls / DeviceActivity の配布用 entitlement と App Review 要件。
- TestFlight 外部テスター配布の最新要件。
- 採用する PaaS / マネージド PostgreSQL のデータ保存場所、バックアップ、暗号化、ログ保持。

## 保留ではなく後続で扱うもの

- 具体的な PaaS / DB サービス選定。
- Apple サインインの実装ライブラリ選定。
- `devices` テーブルの最終 schema。
- プライバシーポリシー本文。
- App Store / TestFlight 用の説明文。
