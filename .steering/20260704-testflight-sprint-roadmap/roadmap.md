# ロードマップ — TestFlight スプリント（2026-07 〜 8月初旬）

> **履歴資料（2026-07-12再基準化）**：本書は2026-07-04時点の実装スプリント計画として保持する。現在のリリース正本は [20260711-release-roadmap-rebaseline](../20260711-release-roadmap-rebaseline/review-pack.md) と `wbs/wbs.yml` の `REL-0 / REL-1 / REL-2`。本書の日付、3イベント、iOSを計測付属アプリとして扱う前提、TestFlight配信を到達点とする前提は現在のゲート判定に使わない。

> ステアリング：`20260704-testflight-sprint-roadmap`
> 作成日：2026-07-04
> 手段：`grill-with-docs`（1問ずつ意思決定・推奨値提示）で確定した決定簿と週次計画。
> 関連：`.steering/20260630-cloud-auth-boundary/distribution-rollout-plan.md`（工程1〜8の親計画）

---

## 1. 北極星

当時の北極星は**TestFlight 20〜50人への小規模検証版配信**。再基準化後は、社内実機確認、TestFlight小規模検証、一般公開までを連続したロードマップとし、道場発表は親進捗に含めない別レーンとする。

## 1.1 進捗更新（2026-07-07）

- サーバー側整備は完了。詳細は `../20260707-testflight-backend-readiness/` に記録済み。
- 完了済み：`POST /api/auth/apple/native`、`POST /api/devices` の `clientDeviceId` upsert、`POST /api/usage/daily` のバケット最大値マージ、`DELETE /api/account`、`GET /api/health`、Render 手順書、DB 通し検証、build/lint/typecheck/test。
- 次の最優先は、Mac 上で `apps/ios/` を作り、ネイティブ Sign in with Apple → デバイス登録 → DeviceActivity 集計 → クラウド送信の一気通貫を通すこと。
- 一気通貫が通ったら、その日から開発実機で 7日連続計測を開始する。

## 2. 決定簿（グリル確定事項）

| # | 論点 | 決定 | 付帯条件 |
|---|---|---|---|
| 1 | 到達点 | TestFlight 20〜50人配信 | 道場発表は別レーン |
| 2 | 目標時期 | 8月初旬 | 決定4により「目標日」扱い |
| 3 | スコープ | DeviceActivity 必須のまま進める | 配布用 Family Controls entitlement は本体・Extension とも審査完了済み（2026-07-06確認） |
| 4 | 審査遅延時 | entitlement 審査待ちは解消 | 以後のスリップは実装遅れとして扱う。残る外部審査は TestFlight 外部テスト前の Beta App Review |
| 5 | 発表（4週間以内）との両立 | 時間差配置 | スライド完成は本番1週間前がゲート |
| 6 | planning repo 停止バグ | W1 中に修正して閉じる | owner 解決修正 → 反映 → コミットまで |
| 7 | Shortcuts 経路 | ネイティブアプリ（DeviceActivity）に吸収 | 実機検証ゲートはクローズ。`ios_shortcut` の値は互換のため残置 |
| 8 | テスター募集 | 道場発表で告知 | デッキに募集1枚を追加 |
| 9 | Sheets 同期 | 当時はTestFlight配信完了で廃止予定 | 再基準化後は自動廃止せず、GitHub同期のdry-runと確認ゲート後に再判断 |

## 3. 週次レーン

| 週 | 外部依存・申請 | バックエンド（サーバー / DB） | iPhone アプリ | 道場発表 | 保守・ドキュメント |
|---|---|---|---|---|---|
| W1（7/6〜） | Family Controls entitlement 承認済み確認（本体＋Extension）／Slides・Napkin 認証取得 | サーバー側整備完了（API・schema・migration・Render 手順・検証）。Render 投入準備 | アプリ本体着手（2ターゲット作成・サインイン・デバイス登録） | — | planning repo バグ修正〜クローズ |
| W2（7/13〜） | 配布プロビジョニング準備 | Render デプロイ（TLS・secret・migrate deploy・health 確認）／必要ならテナント越え再検証 | アプリ本体続行。計測→クラウド送信の一気通貫が通り次第 7日連続計測を即開始 | — | 永続 docs は主要差分反映済み。残差があれば追記 |
| W3（7/20〜） | Beta App Review 準備 | 運用ログ確認・PII/secret 非漏洩確認 | 7日連続計測 継続・完了／配布前の端末別再現確認 | デッキ生成（募集1枚含む）。完成＝本番1週間前 | — |
| W4（7/27〜） | Beta App Review / 外部テスター配布準備 | — | 配布署名・entitlement 同梱確認／TestFlight ビルド提出 | リハ・本番（募集告知） | — |
| 8月〜 | 承認され次第 | — | 配信 | — | Sheets 同期廃止・GitHub 一本化 |

## 4. クリティカルチェーンとゲート

実装の依存は1本：実行モード＋認証 provider（完了） → スキーマ（完了） → サーバー API（完了） → Render デプロイ＋Apple サインイン設定 → iOS デバイス登録・同期トークン保存 → 一気通貫確認 → **7日連続計測を即開始** → 配布署名・entitlement 同梱確認 → TestFlight ビルド提出 → Beta App Review → 外部テスター配布。

- **ゲートA（解消済み）**：Family Controls entitlement は本体・Monitor Extension とも承認済み。今後は配布プロファイル・Archive に entitlement が実際に入ることを `codesign` で確認する。
- **ゲートB（最優先）**：計測→送信の一気通貫が動いたら、7日連続計測を即開始する。7日連続計測は圧縮不能なため、開始が遅れるほど提出日がそのまま後ろへ滑る。
- **ゲートC（W3末）**：スライド完成（本番1週間前）。発表日は動かせない真のハード期限で、衝突時はスライドが勝つ。

## 5. リスクと調整弁

- W1 が最も過密。溢れた場合は「アプリ本体の着手を W2 頭へずらす」を第一の調整弁とする（アプリ側の合流点は W3 の一気通貫で、半週の余裕がある）。
- サーバー側は完了済みのため、以後の主な遅延要因は Mac/Xcode 上の iOS 実装、Render 実設定、実機 7日連続計測。
- Family Controls entitlement の審査待ちは解消済み。残る外部審査は TestFlight 外部テスト前の Beta App Review。
- 申請は Account Holder 本人のみ実施可能。今後 Bundle ID を追加する場合は Extension 分の申請漏れに注意する。

## 6. v1 に足す「計測」（機能追加はしない）

スコープ凍結の例外として、イベント計測3点のみ v1 に含める。後続ステアリングの優先判断の根拠データになる。

1. 棚卸し完了（登録 N 件到達）までの所要時間
2. カタログ外登録（`matched_service_id` なし）の発生率
3. 判定表示から行動（解約・継続の操作）までの転換

任意（W2 に余裕がある場合のみ）：オンボーディングに「月いくら払っていると思うか」の事前推定1問を追加し、実額とのギャップを計測する。
