---
name: external-lan-sync-strategy
description: 外部LANからの利用量送信はフェーズ2でクラウドDB方式（VPN不採用）。ローカルファースト完了後に着手
metadata: 
  node_type: memory
  type: project
  originSessionId: 5259727f-c573-4f41-84f8-c43e7e35a88f
---

iPhone が**異なる LAN（外出先・モバイル回線等）からも利用量を送れるようにする**件の方針（2026-06-16 決定）。

- **時期**：将来（フェーズ2相当）。**ローカルファーストの実装が一通り終わってから**着手する。いまは着手しない。
- **方式**：**クラウド方式（クラウドの DB へ送信）**。VPN（Tailscale 等）は「煩雑」としてユーザーが不採用と判断。
- **技術的前提（着手時に効く）**：
  - 「クラウド DB へ送信」には、**受け口の取り込み API（`/api/usage/daily` 相当）自体をクラウドにホスト**する必要がある（DB だけクラウドでは届かない）。最低限「取り込み API＋マネージド Postgres」をデプロイする構成。Prisma + PostgreSQL のままクラウド Postgres に向けられる。
  - これは現在の「**ローカルファースト・クラウド不使用**」方針（`architecture.md` / PRD §8.1・§10.0）からの転換＝フェーズ2の商品版方向。着手時に `architecture.md` と PRD の方針・PII 方針の更新が必要。
  - **PII セキュリティ設計が必須**：個人の利用データをクラウドに置くため、認証・保存時暗号化・アクセス制御を設計する。
  - トポロジ（ハイブリッド＝取り込み+DBのみクラウド／フルクラウド）は着手時に決める（今回は未決）。
- 関連：iPhone 送信方式は [[ios-screen-time-spike-research]]（ネイティブ DeviceActivity）と Web の QR ショートカット。現状は同一 LAN 内 HTTPS・公開ポートなし。
