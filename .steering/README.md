# ステアリング索引

> 最終更新：2026-07-19

`.steering/`は作業時点の要求・設計・判断・進捗を残す履歴である。現行の基本仕様は`docs/`、全体進捗は`wbs/wbs.yml`、テスト結果は`.audit/test-status.md`を正とする。同じ論点に複数の作業文書がある場合は、後続の承認済み文書を優先する。

## 現在の主要文書

| 論点 | 正とする作業文書 | 現在の状態 |
|---|---|---|
| 外部TestFlightから一般公開までの全体計画 | `20260711-release-roadmap-rebaseline/` | 計画承認済み。認証以外の多数の実装・運用ゲートは未完了 |
| Apple認証、通常APIセッション、テナント境界 | `20260713-auth-tenant-boundary/` | 実装、Web自動試験、Xcode・Render実機確認、main反映まで完了 |
| Screen Time計測の自動開始・対象変更・解除 | `20260719-auto-screen-time-measurement-lifecycle/` | 承認済み。実装・Web自動試験済み、Mac・実機回帰待ち |
| iOS計測・同期の現行実装履歴 | `20260707-testflight-ios-implementation/` | 開発用UIで主要処理を実装済み。利用者向け主製品UI、7日計測、Archive/codesignは未完了 |
| Web版のデザイン基準 | `20260618-web-ui-implementation/` | 実装済みWeb UIをiPhoneのブランド正本として利用 |

## 上書き関係

- `20260630-cloud-auth-boundary/`は認証境界の初期設計である。現行のトークン、Cookie、CSRF、セッション失効、固定ユーザー隔離は`20260713-auth-tenant-boundary/`を優先する。
- `20260704-testflight-sprint-roadmap/`は実装前の意思決定履歴である。全体ゲートは`20260711-release-roadmap-rebaseline/`、実装状況は後続のiOS・認証tasklistを優先する。
- `20260707-testflight-backend-readiness/`と`20260707-testflight-ios-implementation/`で確認したAppleサインイン経路は、2026-07-14の認証セッション実装後に再確認が必要である。
- 2026-07-11以前の「iPhoneは利用量センサーだけ」「Webが主製品」という前提は失効している。現行方針はiPhoneを主製品、WebをiPhone固有機能を除く正式クライアントとする。
- 料金・プラン・公式導線の鮮度は外部TestFlight要件の90日を優先する。過去の180日（6か月）補正は現行コードに残る移行対象である。

## 履歴の読み方

- `requirements.md`と`design.md`は、承認時点の要求・設計を示す。後続作業で変更された場合も当時の記録として保持する。
- `tasklist.md`は当該作業の進捗を示す。全体の優先順位・先行条件はWBSを確認する。
- `review-pack.md`の承認は設計着手の承認であり、実環境でのリリース合格を意味しない。
- `HANDOFF.md`、調査、Spike、手順HTMLは履歴・補助資料であり、現行仕様の単独の根拠にしない。
