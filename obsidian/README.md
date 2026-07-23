# Obsidian技術メモ索引

> 最終更新：2026-07-23

`obsidian/`は調査日・観測環境に依存する技術メモであり、製品仕様の正本ではない。現行仕様は`docs/`、作業状態は`.steering/README.md`とWBSを確認する。

| メモ | 現在の適用範囲 |
|---|---|
| `2026-06-07_terminal-japanese-copy-mojibake-osc52.md` | 特定CLIとVS Code統合ターミナルで観測したトラブルシュート。Codex CLIで同症状が再現することを保証しない |
| `2026-06-21_ios-appium-e2e-real-device-pitfalls.md` | local modeとiOS Spikeの実機E2Eに有効。cloud-testflight modeはRender HTTPS、Apple認証セッション、利用者向け3タブUIを使い、最新計測回帰は後続ステアリングを正とする |
| `2026-06-23_icloud-plus-capacity-gate-for-downgrade.md` | 容量ゲートの設計判断は現行。iPhoneの容量保存・再読込・編集とWeb共有まで実機確認済み。見直し全構造化出力は残る |
| `2026-07-20_screen-time-auto-measurement-sync-current-state.md` | Screen Time自動計測・自動同期・契約別保存の現行実装。Mac・実機回帰の合格と、7日連続・日付境界の未確認範囲も記録 |

メモを更新する際は、観測日、適用モード、現行コードへの参照先、後続文書による上書きの有無を明記する。実在の契約・利用量・メール・識別子・資格情報は記録しない。

2026-07-23時点で、iPhone向けWeb UIは実装・自動試験済みで実機確認待ちである。見直し全出力と通知配信は未完成であり、通知設定画面は無効状態で許可要求・予約・配信が未接続である。これらの現行仕様は`docs/`、手動確認は`manuals/`を正とし、重複する技術メモは作らない。
