---
status: accepted
---

# 計測対象アプリの対応付けはユーザー手動、bundleId 自動突合はしない

DeviceActivity / FamilyControls の `FamilyActivityToken` は不透明で、アプリの bundleId や表示名をアプリ・サーバーから取り出せない（Apple のプライバシー設計）。よって「iOS が送った bundleId をサーバーで `service_catalog` と自動突合してサブスクへ紐付ける」ことは技術的に成立しない。対応付けは iOS 上でユーザーが「1サブスク=1計測対象アプリ」を手動選択する方式を正とし、選択トークンは端末外に出さない。`service_catalog.app_bundle_ids` は自動突合には使わず、Picker 時の候補ヒント（並び順・推測表示）に限定する。

## Considered Options

- サーバーが bundleId で自動対応付け：トークン不透明性により取得不能。技術的に不可のため棄却。
- 1サブスクに複数アプリを対応付け可能にする：集計・UI・判定が複雑化し v1 に過剰なため棄却（将来要件化時に再検討）。

## Consequences

- 初回に手動対応付けの手間が発生する（自動化はできない）。
- 既存の `functional-design.md` の「bundleId/domain 突合」記述を「候補ヒント。確定はユーザー手動」に是正する必要がある。
- 対応表・選択トークンは iPhone ローカル限定で保持し、Mac/クラウドへ送らない。
