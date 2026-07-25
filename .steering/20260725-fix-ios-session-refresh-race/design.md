# 設計 — iOSセッション更新競合の修正

## 実装アプローチ

同一のAPI接続先ごとに `APIClient` を1つ返す共有プロバイダーを追加する。
アプリの本番コードで直接生成している `APIClient(baseURL:)` を共有プロバイダー経由に統一する。

`APIClient` は actor であり、既存の `refreshTask` が進行中の更新処理を共有する。全呼び出し元が
同じインスタンスを使用すれば、並行通信は同じ `refreshTask` を待機し、同じ更新トークンを
複数回送らない。依存注入を使う単体テストは独立した `APIClient` を引き続き生成できる。

サーバー側に更新トークン再利用の猶予を追加する案は、不正利用検知を弱めるため採用しない。

## 変更するコンポーネント

| コンポーネント / ファイル                            | 変更内容                                                | 対応する受け入れ条件 |
| ---------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| `apps/ios/SubBuddyApp/App/APIClient.swift`           | 接続先別の共有クライアント取得口を追加                  | AC-1, AC-2           |
| `apps/ios/SubBuddyApp/App/AuthSession.swift`         | Appleサインインとセッション操作に共有クライアントを使用 | AC-1, AC-2           |
| `apps/ios/SubBuddyApp/App/ProductStore.swift`        | 契約等の認証済み通信に共有クライアントを使用            | AC-1, AC-2           |
| `apps/ios/SubBuddyApp/App/NotificationManager.swift` | 通知関連の認証済み通信に共有クライアントを使用          | AC-1, AC-2           |
| `apps/ios/SubBuddyApp/App/MeasurementSession.swift`  | 利用量削除の認証済み通信に共有クライアントを使用        | AC-1                 |
| `apps/ios/SubBuddyAppTests/`                         | 共有境界と並行更新の回帰確認を追加                      | AC-2, AC-3, AC-4     |

## データ構造の変更

なし。API、DB、Keychainのキーと保存形式は変更しない。

## 影響範囲の分析

- `docs/` への影響: なし。既存の認証設計を維持するバグ修正。
- 既存コード・既存機能への影響: iOS内の `APIClient` 生成方法のみ。WebとMonitor Extensionには影響しない。
- 後方互換 / マイグレーションの要否: 不要。

## 設計上の前提

- `APIClient` の `refreshTask` は、同一インスタンス内の並行更新を1回にまとめる。
- API接続先は通常1つだが、Debugの接続先変更に備えてURL単位でクライアントを分離する。
- 更新トークンの再利用検知はセキュリティ上必要なため、サーバー側の判定は維持する。
- テストでは実在の認証情報やPIIを扱わない。
