# Obsidian技術メモ索引

> 最終更新：2026-07-25

`obsidian/`は調査日・観測環境に依存する技術メモであり、製品仕様の正本ではない。現行仕様は`docs/`、作業状態は`.steering/README.md`とWBSを確認する。

利用者向け製品名はMUDASKである。リポジトリ名、Target・Scheme、Bundle ID、App Group、環境変数、API URLなどの内部識別子はSubBuddyを維持する。技術メモ中のSubBuddyは、原則として記録時点の名称または内部識別子を指す。

| メモ                                                            | 現在の適用範囲                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-06-07_terminal-japanese-copy-mojibake-osc52.md`           | 特定CLIとVS Code統合ターミナルで観測したトラブルシュート。Codex CLIで同症状が再現することを保証しない                                                             |
| `2026-06-21_ios-appium-e2e-real-device-pitfalls.md`             | local modeとiOS Spikeの実機E2Eに有効。cloud-testflight modeはRender HTTPS、Apple認証セッション、利用者向け3タブUIを使い、最新計測回帰は後続ステアリングを正とする |
| `2026-06-23_icloud-plus-capacity-gate-for-downgrade.md`         | 容量ゲートの設計判断は現行。iPhoneの容量保存・再読込・編集とWeb共有まで実機確認済み。見直し全構造化出力は残る                                                     |
| `2026-07-20_screen-time-auto-measurement-sync-current-state.md` | Screen Time自動計測・自動同期・契約別保存の現行実装。Mac・実機回帰の合格と、7日連続・日付境界の未確認範囲も記録                                                   |

メモを更新する際は、観測日、適用モード、現行コードへの参照先、後続文書による上書きの有無を明記する。実在の契約・利用量・メール・識別子・資格情報は記録しない。

2026-07-25時点で、Web・iPhoneの利用者向け表示はMUDASKへ変更され、利用者が表示とiPhoneのAppleログイン成功を確認済みである。iPhoneは同じAPI URLの通信で認証更新を共有する。Webの支出の内訳は、モバイルの縦並びとPCの横棒表示を自動試験で確認済みである。

複数ブラウザ利用を禁止する仕様ではない。目標仕様はWeb有効セッション10件と登録iPhone5台を別枠で扱うことだが、現行コードはWeb・iOSを合算して10件に制限し、Web設定にセッション一覧・個別失効UIがない。この差分は未解消である。

通知は端末内予約、端末現地9〜20時のサーバー配信制御、通知作成失敗時の再実行、APNs送信待ち、お知らせ、削除予定日程、安全通知コマンドまで実装した。メール通知と通知用メールアドレス保存は行わない。機能フラグは初期オフで、iOS・APNs・Render Cron・削除上流との実環境結合後に段階有効化する。現行仕様は`docs/`、作業状態は`.steering/20260723-notification-delivery/tasklist.md`と`.steering/20260725-sync-docs-current-state/`、手動確認は`manuals/notification-delivery-setup-and-check.md`を正とし、重複する技術メモは作らない。
