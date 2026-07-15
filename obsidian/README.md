# Obsidian技術メモ索引

> 最終更新：2026-07-15

`obsidian/`は調査日・観測環境に依存する技術メモであり、製品仕様の正本ではない。現行仕様は`docs/`、作業状態は`.steering/README.md`とWBSを確認する。

| メモ | 現在の適用範囲 |
|---|---|
| `2026-06-07_terminal-japanese-copy-mojibake-osc52.md` | 特定CLIとVS Code統合ターミナルで観測したトラブルシュート。Codex CLIで同症状が再現することを保証しない |
| `2026-06-21_ios-appium-e2e-real-device-pitfalls.md` | local modeとiOS Spikeの実機E2Eに有効。cloud-testflight modeの主経路はRender HTTPSと現行認証セッションであり、LAN IPや`USAGE_SYNC_TOKEN`を使わない |
| `2026-06-23_icloud-plus-capacity-gate-for-downgrade.md` | 容量ゲートの設計判断は現行。コード行番号とApple外部仕様は参照日依存。利用者向け表示は確認優先度へ移行予定 |

メモを更新する際は、観測日、適用モード、現行コードへの参照先、後続文書による上書きの有無を明記する。実在の契約・利用量・メール・識別子・資格情報は記録しない。
