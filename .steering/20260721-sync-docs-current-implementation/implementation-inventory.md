# 現行実装一覧（2026-07-21）

文書照合に使う実装・検証状態の作業用一覧。仕様の正本ではない。

## 実装済み

### Web / API

- 契約CRUD、支出集計、更新間近、見直し一覧・再計算、サービスカタログ。
- Appleサインイン、アクセストークン、更新トークンのローテーション、Web Cookie、CSRF、セッション・端末失効、アカウント物理削除。
- 案内進捗`user_guidance_progress`とGET/PATCH API。
- Webの「使い方」「設定」、cloud modeのログアウト、local modeの非ログイン説明。
- 契約単位の利用量・見直し削除APIと、利用量なしでの再計算。

### iPhone

- 初回説明、Appleサインイン、最初の契約、支出、棚卸し、任意計測、最初の見直し。
- 「ホーム」「契約」「見直し」の3タブと、ホーム右上の設定。
- 契約CRUD、iCloud+容量、支出内訳、更新間近、見直し、セッション、完全退会。
- 初回利用後の4段階案内。ホームは未完了の次の1項目だけを表示し、初回導線の最初の見直し、または通常画面の見直し詳細1件で見直し確認を満たした後は案内カードを消す。
- 契約・支出・見直し・更新間近の「この画面について」。説明と再表示ボタンは排他的に表示する。
- Apple公式ボタンは高さ44pt・最大幅320pt。通常操作色と塗りつぶし文字色はライト・ダークで動的に切り替える。
- Screen Timeの1契約1アプリ、自動開始、対象変更・解除、認可取消後の再開、契約削除時の対象限定後片付け。
- 起動、Appleサインイン完了、フォアグラウンド復帰の3契機による利用量自動同期。失敗時保持と設定からの手動再試行。

## 検証済み

- Webの初回案内・設定・ログアウトを含む単体、API、型、変更箇所lint、build、E2E。
- iPhone主製品UIの基礎実装、契約CRUD、iCloud+容量保存・再読込、支出・更新数値、従来のScreen Time計測・同期、初回導線中断・再開。
- 2026-07-17時点の標準・大画面、ライト・ダーク・高コントラスト、最大Dynamic Type、VoiceOver、44pt操作領域、合成200契約性能。
- Screen TimeのWeb API・テナント境界・冪等性と、7日分の合成集計。
- 2026-07-21に、iPhoneの案内表示、ホームカード完了状態、Appleボタン寸法、ダークモード操作色、Screen Time自動同期をMac・iPhone実機で回帰確認。

## 実装後のMac・実機確認が残る範囲

- Screen Time自動ライフサイクル変更後のiOS全回帰、認可取消・再許可、変更失敗からの再開。
- 7日連続、実日付境界の実機確認。
- 見直しの全構造化出力、完全退会の実機結合、オフライン・競合・アプリロック、出力、通知、問い合わせ、Archive/codesign。

## データモデル

`users`、`user_guidance_progress`、`devices`、`auth_sessions`、`subscriptions`、`billing_events`、`ios_usage_daily_summaries`、`recommendation_snapshots`、`service_catalog`、`service_plans`、`service_alternatives`。

## 根拠

- `apps/web/prisma/schema.prisma`
- `apps/web/src/app/api/`
- `apps/ios/SubBuddyApp/App/`
- `apps/ios/SubBuddyApp/Shared/`
- `.audit/test-status.md`
