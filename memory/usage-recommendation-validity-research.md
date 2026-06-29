---
name: usage-recommendation-validity-research
description: iPhone利用量だけで解約判定する妥当性の限界。適性分類が必要＝別ステアリング化。調査完了
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f473a3b-2b21-41a9-8c91-29dcb5b91de3
---

「iPhone Screen Time（DeviceActivity）の利用量だけでサブスク解約を判定する」ことの妥当性を feature-research で調査完了（2026-06-06）。成果物：`research/20260606-usage-based-recommendation-validity/investigation.md`。

**核心の発見**：Apple は計測対象を「アプリが**画面の最前面にある時間**」と定義。→ (a) 別端末利用（TV/Apple TV/ゲーム機/Mac/車載/スマートスピーカー）、(b) **バックグラウンド/画面オフの音声再生**（音楽・ポッドキャスト＝iPhoneにアプリがあっても利用ゼロ扱い）、(c) クラウド保管/バックアップ/保険/会費、(d) 家族共有で別の人が使う分、はほぼ計測されない。→ 素朴な「未使用＝解約候補」は誤判定を量産する。大手 Rocket Money は利用計測でなく銀行取引で検出（本アプリは方針上採れない）。他サービスの課金は読めない（サンドボックス）。

**戦略（深掘り再調査＋codex反証で方向転換）**：機能の旗を「解約レコメンド」→**「見直し優先度（どの契約を先に見直すか）」に再定義**。**強い解約候補は利用量に依存させず、重複・高額・低importance・更新間近で出す**。利用量は「使っている確証（正の証拠）」としてのみ使い、“利用ゼロ＝解約候補”は出さない（棄却）。未分類・低信号は必ず保守側に倒す。**ユーザー訂正ループ（使っている/重要/対象外）必須**。確信度%は出さず根拠の一文＋問いかけ＋優先度の別軸で。
追加の確定根拠：競合(Rocket Money等)は誰も利用量を計測していない＝利用量で解約判定は業界前例なし。Share Across Devices で別端末利用が iPhone に“過大”合算もされうる（信号は過小・過大の双方向に汚染）。学術＝信号不足は棄却(abstain)、確信度バッジ単独は誤較正を見抜けない、断定は過剰依存を招く。行動経済学＝サンクコスト・解約遅延が提供価値の核。
**MVP は絞る**：U/H/I/D 4方式フル導入・DataStatus enum拡張・手動宣言を同時に入れるのは過大。最小＝カテゴリ正規化＋保守的棄却＋「重複/高額/低importance/更新間近」での優先度。方式は少数 preset を config 外出し＋recompute.ts で解決、computeRecommendation は純関数のまま（フェーズ5の hasUsageData 棄却の一般化）。enum拡張・ユーザー上書き列・Shortcuts/visit は後段。

**未解決（要実機・Spike連携）**：第三者 DeviceActivity API が iCloud 同期の複数端末合算を見るか単一端末のみかは一次ソースで未確定（単一端末説は反証で棄却）。WebDomainの範囲も不確実。

**進め方の決定**：この適性問題は [[ios-screen-time-spike-research]] の技術 Spike（`20260606-ios-screen-time-spike`）とは**別ステアリング**にする。Spike は「技術的に配管が動くか」のみ、本テーマは「どのサブスクに有効か（妥当性）」。Spike の go は機能全体の GO を意味せず、本格実装着手は〔技術go〕×〔適性結論〕の両方が揃ってから。別ステアリングは調査(investigation.md)を入力に正式起票予定。[[mvp-status]]
