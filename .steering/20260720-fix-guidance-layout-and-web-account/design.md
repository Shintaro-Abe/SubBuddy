# 設計 — 案内レイアウトとWebアカウント操作の修正

## 実装アプローチ

iPhoneは説明とPickerを同じ`Section`内の`VStack`へ配置し、明示的な間隔と縦方向の可変高さを持たせる。Webは既存の`POST /api/auth/logout`をクライアント部品から呼び、成功時だけ`/sign-in`へ移動する。設定ページはサーバー側で認証モードを判定し、local modeに無意味なログアウトを出さない。

## 変更するコンポーネント

| コンポーネント / ファイル | 変更内容 | 対応AC |
|---|---|---|
| `SubscriptionViews.swift` | 説明と表示フィルターを間隔付きで縦配置 | AC-1, AC-6 |
| `SidebarNav.tsx` | 「設定」への導線を追加 | AC-2 |
| `app/(dashboard)/settings/page.tsx` | 認証モード別の設定画面を追加 | AC-2, AC-3, AC-5 |
| `LogoutButton.tsx` | CSRF付きログアウト、処理中、失敗表示、成功後遷移 | AC-3, AC-4, AC-6 |
| Web E2E・単体テスト | 設定導線、local表示、ログアウト操作を合成条件で確認 | AC-2〜AC-6 |

## データ構造・API変更

なし。既存の`POST /api/auth/logout`を再利用する。

## 影響範囲

- `docs/`: 既存機能設計にログアウトAPIとWeb共通ナビが定義済みのため変更不要。
- 既存コード: iPhone契約一覧の上部レイアウト、Webサイドバーのみ。
- マイグレーション: なし。

## 設計上の前提

- cloud modeではCookie認証とCSRF Cookieが設定済みである。
- local modeは固定ローカル利用者を使い、ログイン・ログアウトを行わない。
- 認証情報や個人情報を画面、ログ、テストへ追加しない。
