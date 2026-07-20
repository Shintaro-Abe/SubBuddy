# Obsidian技術メモ索引

> 最終更新：2026-07-20

`obsidian/`は調査日・観測環境に依存する技術メモであり、製品仕様の正本ではない。現行仕様は`docs/`、作業状態は`.steering/README.md`とWBSを確認する。

| メモ | 現在の適用範囲 |
|---|---|
| `2026-06-07_terminal-japanese-copy-mojibake-osc52.md` | 特定CLIとVS Code統合ターミナルで観測したトラブルシュート。Codex CLIで同症状が再現することを保証しない |
| `2026-06-21_ios-appium-e2e-real-device-pitfalls.md` | local modeとiOS Spikeの実機E2Eに有効。cloud-testflight modeはRender HTTPS、Apple認証セッション、利用者向け3タブUIを使い、LAN IPや`USAGE_SYNC_TOKEN`を主経路にしない |
| `2026-06-23_icloud-plus-capacity-gate-for-downgrade.md` | 容量ゲートの設計判断は現行。iPhoneの容量表示・入力と登録済み契約の実機読込は実装・確認済み。容量保存と見直し全出力の実機回帰は残る |
| `2026-07-20_screen-time-auto-measurement-sync-current-state.md` | Screen Time自動計測・自動同期・契約別保存の現行実装。日付境界と配布前テストの未確認範囲も記録 |

メモを更新する際は、観測日、適用モード、現行コードへの参照先、後続文書による上書きの有無を明記する。実在の契約・利用量・メール・識別子・資格情報は記録しない。
