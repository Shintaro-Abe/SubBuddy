# manuals（操作手順書）

このフォルダには、**人が手で行う必要がある操作・実機確認**の手順書を置きます。
外部サービスのGUI設定、ブラウザでの認証、iPhone実機でしか確認できない操作を、**初学者エンジニアでも迷わず進められる**ように説明します。

## 置き場所の方針

- **`docs/`**：アプリの恒久的な設計（何を・どう作るか）。
- **`.steering/`**：個々の開発作業の要求・設計・タスク。
- **`manuals/`**（このフォルダ）：**人手の操作手順**。セットアップや運用で「自分の手で」やる作業の説明書。

> 手順書には**実在のパスワード・トークン・鍵などの秘密情報を書きません**。秘密情報は環境変数（`.env`）で管理し、リポジトリにはコミットしません（`AGENTS.md`のPII・秘密情報の方針に従います）。

## 一覧

| ファイル | 内容 | 関連作業 |
|---|---|---|
| [wbs-google-setup.md](./wbs-google-setup.md) | WBS 同期のための Google 側の初期設定（**サービスアカウント方式**：プロジェクト作成・API 有効化・SA 作成と鍵発行・スプレッドシート共有） | `.steering/20260602-wbs-sync/` |
| [apple-sign-in-setup.md](./apple-sign-in-setup.md) | Appleサインイン、App Group、Family Controlsの設定 | `.steering/20260713-auth-tenant-boundary/`、`.steering/20260719-auto-screen-time-measurement-lifecycle/` |
| [render-predeploy-setup.md](./render-predeploy-setup.md) | RenderのDB、Web Service、migration、環境変数の準備 | `.steering/20260711-release-roadmap-rebaseline/` |
| [ios-xcodegen-project-setup.md](./ios-xcodegen-project-setup.md) | XcodeGenによるiOSプロジェクト生成とターゲット確認 | `apps/ios/project.yml` |
| [ios-render-e2e-testflight-prep.md](./ios-render-e2e-testflight-prep.md) | 利用者向けiPhone UIとRenderの実機API結合確認 | `.steering/20260716-ios-main-ui/` |
| [ios-contract-crud-real-device-check.md](./ios-contract-crud-real-device-check.md) | iPhone実機での合成契約の登録・編集・削除とiCloud+容量再読込 | `.steering/20260716-ios-main-ui/` |
| [ios-spending-renewal-real-device-check.md](./ios-spending-renewal-real-device-check.md) | iPhoneとWeb版の支出・カテゴリ・6か月推移・14日以内更新の数値照合 | `.steering/20260716-ios-main-ui/` |
| [ios-onboarding-interruption-resume-check.md](./ios-onboarding-interruption-resume-check.md) | iPhone初回導線の空・通信失敗・中断・保存済み進捗からの自動再開・完了後案内 | `.steering/20260716-ios-main-ui/`、`.steering/20260720-first-use-guidance/` |
| [ios-ui-quality-check.md](./ios-ui-quality-check.md) | iPhone UIの画面サイズ、表示設定、VoiceOver、操作領域、案内の排他表示、操作色、Appleボタン寸法、合成200契約性能 | `.steering/20260716-ios-main-ui/`、`.steering/20260720-fix-ios-controls-dark-mode/` |
| [ios-screen-time-measurement-sync-real-device-check.md](./ios-screen-time-measurement-sync-real-device-check.md) | iPhone Screen Timeの1日計測、アプリ復帰時の自動同期、通信失敗後の自動再送、見直し反映、同日再送、契約削除時の後片付け | `.steering/20260716-ios-main-ui/`、`.steering/20260719-auto-usage-sync/` |
| [ios-screen-time-auto-measurement-regression-check.md](./ios-screen-time-auto-measurement-regression-check.md) | Swift Actor隔離・Simulator起動前検査の修復確認と、Screen Time自動開始・変更・解除・認可復帰・通信失敗の回帰確認 | `.steering/20260719-auto-screen-time-measurement-lifecycle/`、`.steering/20260719-auto-usage-sync/` |
| [render-screen-time-usage-db-query.md](./render-screen-time-usage-db-query.md) | Render Web ServiceのShellからScreen Time同期の到達日時と日別集計値を安全に確認する | `.steering/20260719-auto-usage-sync/` |
| [ios-screen-time-seven-day-continuous-check.md](./ios-screen-time-seven-day-continuous-check.md) | iPhone Screen Timeの7日連続計測、自動同期、再起動、通信切断、自動再送、同日再送、日付境界 | `.steering/20260711-release-roadmap-rebaseline/`、`.steering/20260719-auto-usage-sync/` |
