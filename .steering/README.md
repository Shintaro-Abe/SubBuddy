# ステアリング索引

> 最終更新：2026-07-21

`.steering/`は作業時点の要求・設計・判断・進捗を残す履歴である。現行の基本仕様は`docs/`、全体進捗は`wbs/wbs.yml`、テスト結果は`.audit/test-status.md`を正とする。同じ論点に複数の作業文書がある場合は、後続の承認済み文書を優先する。

## 現在の主要文書

| 論点 | 正とする作業文書 | 現在の状態 |
|---|---|---|
| 外部TestFlightから一般公開までの全体計画 | `20260711-release-roadmap-rebaseline/` | 計画承認済み。認証以外の多数の実装・運用ゲートは未完了 |
| Apple認証、通常APIセッション、テナント境界 | `20260713-auth-tenant-boundary/` | 実装、Web自動試験、Xcode・Render実機確認、main反映まで完了 |
| iPhone利用者向け主製品UI | `20260716-ios-main-ui/` | 3タブ、契約・支出・見直し・設定、主要実機API結合、UI品質を確認済み。残機能は移植表を正とする |
| Screen Time計測の自動開始・対象変更・解除 | `20260719-auto-screen-time-measurement-lifecycle/` | コードとWeb側試験を実装済み。最新変更後のMac・実機回帰待ち |
| Screen Time利用量の自動同期 | `20260719-auto-usage-sync/` | 3同期契機、失敗保持、設定表示を実装し、修復後のMac・iPhone実機回帰まで完了 |
| 初回利用後の案内と進捗共有 | `20260720-first-use-guidance/` | Web・共通APIの自動/E2E確認とiPhoneのMac・実機画面回帰まで完了 |
| iPhone案内完了状態 | `20260720-fix-ios-review-guidance-state/` | 見直し1件で案内を充足し、完了後カードと重複説明を削除。Mac・実機回帰まで完了 |
| iPhone操作部品・ダークモード | `20260720-fix-ios-controls-dark-mode/` | Appleボタン寸法と共通操作色を実装。コントラスト計算とMac・実機回帰まで完了 |
| Web設定・ログアウト | `20260720-fix-guidance-layout-and-web-account/` | 設定導線、cloud modeログアウト、local mode説明を自動/E2E確認済み |
| Web版のデザイン基準 | `20260618-web-ui-implementation/` | 実装済みWeb UIをiPhoneのブランド正本として利用 |

## 上書き関係

- `20260630-cloud-auth-boundary/`は認証境界の初期設計である。現行のトークン、Cookie、CSRF、セッション失効、固定ユーザー隔離は`20260713-auth-tenant-boundary/`を優先する。
- `20260704-testflight-sprint-roadmap/`は実装前の意思決定履歴である。全体ゲートは`20260711-release-roadmap-rebaseline/`、実装状況は後続のiOS・認証tasklistを優先する。
- `20260707-testflight-backend-readiness/`と`20260707-testflight-ios-implementation/`は開発用UI・初期クラウド経路の履歴である。認証は`20260713-auth-tenant-boundary/`、利用者向けUIは`20260716-ios-main-ui/`、計測・同期は2026-07-19の2作業を優先する。
- 2026-07-11以前の「iPhoneは利用量センサーだけ」「Webが主製品」という前提は失効している。現行方針はiPhoneを主製品、WebをiPhone固有機能を除く正式クライアントとする。
- `20260720-first-use-guidance/`の「完了後は通常の見直しカードへ戻す」設計は、`20260720-fix-ios-review-guidance-state/`で上書きした。案内完了後はホームの案内カードを消し、見直しタブから候補を確認する。
- 料金・プラン・公式導線の鮮度は外部TestFlight要件の90日を優先する。過去の180日（6か月）補正は現行コードに残る移行対象である。

## 履歴の読み方

- `requirements.md`と`design.md`は、承認時点の要求・設計を示す。後続作業で変更された場合も当時の記録として保持する。
- `tasklist.md`は当該作業の進捗を示す。全体の優先順位・先行条件はWBSを確認する。
- `review-pack.md`の承認は設計着手の承認であり、実環境でのリリース合格を意味しない。
- `HANDOFF.md`、調査、Spike、手順HTMLは履歴・補助資料であり、現行仕様の単独の根拠にしない。
