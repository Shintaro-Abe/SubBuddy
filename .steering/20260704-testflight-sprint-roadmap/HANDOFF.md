# 引き継ぎ書（TestFlight スプリント 2時間作業会）

> 作成：2026-07-07 / 次セッションはまずこの1枚を読めば再開できる。
> ブランチ：`main`
> 前提：対象ステアリングは `.steering/20260704-testflight-sprint-roadmap/`。Fuguモデルがこのステアリングを継続する想定。

---

## 1. 現在地（ひとことで）

- 今日の主対象は `.steering/20260704-testflight-sprint-roadmap`。
- 2時間作業会では、W1 の過密タスクのうち「7日連続計測の開始を遅らせない」ことを最優先にする方針。
- このセッションではコード実装・テスト実行はしていない。対象ステアリングの読み取りと作業予定の整理のみ。
- 作業ツリーには既存の未コミット変更が多数ある。今回作成したのはこの `HANDOFF.md` のみ。

## 2. このセッションでやったこと

- 対象ステアリングの主要ファイルを確認した。
  - `.steering/20260704-testflight-sprint-roadmap/roadmap.md`
  - `.steering/20260704-testflight-sprint-roadmap/review-pack.md`
  - `.steering/20260704-testflight-sprint-roadmap/ios-implementation-decisions.md`
  - `.steering/20260704-testflight-sprint-roadmap/fugu-grill-with-docs-prompt.txt`
- `roadmap.md` から、北極星は「TestFlight 20〜50人への小規模検証版配信」と確認した。
- Family Controls entitlement は本体・Monitor Extension とも承認済みとして扱う。残る外部審査は TestFlight 外部テスト前の Beta App Review。
- クリティカルチェーン上、最優先ゲートは「計測→送信の一気通貫が動いたら、7日連続計測を即開始」。
- 今日の2時間作業会の予定を次の方針で整理した。
  - 最初の30分だけ planning repo 停止バグを見る。
  - 詰まりそうなら iOS/計測レーンへ戻す。
  - 主目的は W1 の見通し作りではなく、7日計測開始を遅らせないこと。

## 3. 状態・検証結果

- 実装なし。
- lint / typecheck / test は未実行。
- `git status --short .steering/20260704-testflight-sprint-roadmap` の確認時点では、以下が未コミットだった。
  - 変更済み：`.steering/20260704-testflight-sprint-roadmap/roadmap.md`
  - 未追跡：`.steering/20260704-testflight-sprint-roadmap/fugu-grill-with-docs-prompt.txt`
  - 未追跡：`.steering/20260704-testflight-sprint-roadmap/ios-implementation-decisions.md`
- リポジトリ全体には他ステアリング・docs・memory などの未コミット変更もある。今回の引き継ぎでは詳細確認していない。

## 4. 再開時の最初の一手

1. まず対象ファイルの現状を確認する。

   ```bash
   git status --short .steering/20260704-testflight-sprint-roadmap
   sed -n '1,220p' .steering/20260704-testflight-sprint-roadmap/roadmap.md
   sed -n '1,260p' .steering/20260704-testflight-sprint-roadmap/ios-implementation-decisions.md
   ```

2. 今日の2時間枠を次の順で進める。

   | 時間 | 作業 | ゴール |
   |---:|---|---|
   | 0:00-0:10 | 現状確認 | 対象ステアリングと未コミット差分を確認し、今日触る範囲を固定 |
   | 0:10-0:35 | planning repo 停止バグの状況確認 | W1 保守タスク。今日直すか後回しにするか判断 |
   | 0:35-1:20 | iOS 実装の最短着手点を決める | `apps/ios/` の2ターゲット構成、Bundle ID、App Group、Spike 移植元を実装タスクへ分解 |
   | 1:20-1:45 | API 側の先行確認 | `POST /api/usage/daily`、device token、Apple native auth の欠けを洗う |
   | 1:45-2:00 | 次アクション固定 | 次回の最初の1タスクを決める。必要ならステアリングへ反映 |

3. 完了条件は次の4点。
   - 7日連続計測開始までに必要な未完了タスクが一覧化されている。
   - `apps/ios/` の初回実装タスクが3〜5個に分解されている。
   - planning repo バグを今日直すか、別枠に逃がすか判断済み。
   - 次回の最初の作業が1つに決まっている。

## 5. 残・別スコープ（今回やらないこと）

- この引き継ぎではコード実装に入っていない。
- `docs/`、ADR、memory の未コミット変更は、このセッションでは中身を精査していない。
- planning repo 停止バグの原因調査は未着手。
- `apps/ios/` の作成、API 実装、Apple サインイン実装、TestFlight 提出準備は未着手。

## 6. 申し送り（小）

- `review-pack.md` には古い前提らしき記述が残っている可能性がある。例：前提1に「entitlement 申請が今週中に提出される」とある一方、`roadmap.md` と `ios-implementation-decisions.md` では entitlement 承認済みとして扱っている。再開時に整合確認が必要。
- `ios-implementation-decisions.md` の実装前チェックリストが、iOS/API/TestFlight の作業分解の主材料になる。
- PII・機微データ方針に注意。実データ、実メール、資格情報、Screen Time の詳細ログ、本番DBは読まない・書かない・外部送信しない。

---

## 7. 2026-07-07 作業ログ（バックエンド先行実装）

2時間作業会では、planning repo 停止バグよりも「7日連続計測を遅らせない」ためのサーバー側クリティカルギャップを優先して実装した。Linux コンテナでは Xcode/iPhone 実機検証ができないため、`apps/web` の同期・認証・削除 API を先行整備した。

### 実装済み

- ADR 0006：`POST /api/usage/daily` の保存を後勝ち上書きから max マージへ変更。
  - `usageBucket` は大きい方を採用。
  - `used` は OR。
  - `estimatedMinutesMin/Max` は null 安全に最大値へ寄せる。
- ADR 0004：Apple identity token 検証を `APPLE_ALLOWED_CLIENT_IDS` の aud 許可リスト方式へ変更。
  - `com.subbuddy.web,com.subbuddy.app` を `.env.example` に追加。
  - 既存 `APPLE_CLIENT_ID` は後方互換の fallback として残す。
- D2：`POST /api/auth/apple/native` を追加。
- D3：デバイス登録を `clientDeviceId`（iOS 端末内生成 UUID）で冪等化。
  - `devices.client_device_id` 追加。
  - `(user_id, client_device_id)` unique 追加。
  - `POST /api/devices` は `clientDeviceId` がある場合 upsert。
- D7：`DELETE /api/account` を追加。
  - Apple identity token で本人確認し、該当 `users` を物理削除。
  - 関連データは DB cascade で削除。

### 追加・変更ファイル（主なもの）

- `apps/web/src/repositories/usage.ts`
- `apps/web/src/lib/apple-auth.ts`
- `apps/web/src/app/api/auth/apple/native/route.ts`
- `apps/web/src/app/api/account/route.ts`
- `apps/web/src/services/auth.ts`
- `apps/web/src/schemas/auth.ts`
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260707093000_add_client_device_id/migration.sql`
- `docs/functional-design.md`
- `docs/architecture.md`
- `.steering/20260704-testflight-sprint-roadmap/ios-implementation-decisions.md`

### 検証済み

`apps/web` で以下が成功。

```bash
npm run typecheck
npm run lint
npm run test
npx prisma validate
```

最終確認時点：

- Test Files: 16 passed
- Tests: 120 passed

### 次の最優先

1. Mac/Xcode 側で `apps/ios/` を作成し、Spike から Host App + DeviceActivityMonitor Extension を移植する。
2. iOS は Keychain に以下を保存する。
   - `clientDeviceId`（UUID。初回生成後は再利用）
   - `deviceSyncToken`
3. iOS 登録フローは `POST /api/auth/apple/native` → `POST /api/devices` → `POST /api/usage/daily` の順で一気通貫させる。
4. 一気通貫が通り次第、開発実機で7日連続計測を即開始する。

### 未完了

- planning repo 停止バグは未着手。今日の判断として後回し。
- iOS アプリ本体、Extension、実機7日計測は未着手。
- `DELETE /api/account` の iOS UI は未着手。
- 本日分は gitleaks クリーン確認後にコミット・push 済み（`36bd910` → `origin/main`、48 files）。作業ツリーはクリーン。
- 後追いステアリング `.steering/20260707-testflight-backend-readiness/` を作成済み（要求・設計・タスク・レビューパック）。

### 次セッションの開始点（更新）

- サーバー側は実装・実DB検証・本番ビルドまで完了し main に反映済み。次はクリティカルチェーン C：Apple サインイン値の用意 → Render 構築 → Web 単体でクラウド検証 → iOS 実装 → 7日連続計測。
- iOS 実装は Mac/Xcode 必須でこの Linux コンテナ不可。

---

## 8. 2026-07-07 作業ログ（Render 投入準備・実DB検証・ビルド修正）

7 のバックエンド実装に続き、Render デプロイを一発で通すための準備と検証を行った。

### 実施

- Render 手順書の環境変数を今日の実装に合わせて是正。
  - `manuals/render-predeploy-setup.md` / `.html` に `APPLE_ALLOWED_CLIENT_IDS=com.subbuddy.web,com.subbuddy.app` を追加（ADR 0004）。
  - `/api/health` の起動確認手順とチェック項目を追加。
  - HTML は `node .agents/skills/procedure-guide/assets/md2guide.mjs manuals/render-predeploy-setup.md manuals/render-predeploy-setup.html` で再生成。
- ヘルスチェック `GET /api/health` を追加（DB・secret に触れない軽量応答）。
- ローカル実 PostgreSQL で通し検証（fake ではなく実 DB）。
  - `apps/web/scripts/verify-cloud-apis.mjs`（`npm run verify:cloud-apis`）を追加。
  - `npx prisma migrate deploy`（Render の pre-deploy と同じ）が新規マイグレーション込みでクリーン適用されることを確認。
  - デバイス冪等 upsert・利用量 max マージ・テナント越え防止・アカウント削除カスケードが全項目 PASS。
- 本番ビルドのブロッカーを解消。
  - `next/font/google`（Zen Kaku Gothic New 他）がビルド時に外部フォント取得へ依存し失敗していた。
  - `apps/web/src/app/layout.tsx` から next/font を除去し、`globals.css` のフォント変数を外部取得不要の system フォント fallback に変更。
  - `npm run build` が成功（新規 API ルートも出力を確認）。

### 検証済み

`apps/web` で成功。

```bash
npm run typecheck
npm run lint
npm run test          # 16 files / 120 passed
npm run build         # 成功
npm run verify:cloud-apis   # 実DB通し検証・全 PASS（要ローカル DB 起動）
```

ローカル DB 起動は `bash apps/web/scripts/setup-local-db.sh`（sudo 必要）。

### 申し送り（フォント）

- ビルドを通すため Web フォントの自動取得をやめ system fallback にした。閲覧端末に該当フォントが無い場合の見た目が変わる。
- デザインを厳密に保つなら、後続で `next/font/local`＋自ホストのフォントファイル（ライセンス確認）に切り替える。今回は Render 投入優先で fallback を採用。

### 次アクション（変更なし）

- Apple サインイン値を用意 → Render 構築（手順書どおり）→ Web 単体でクラウド検証 → iOS 接続 → 7日連続計測。
