# 設計 — Webファビコン・iOSアプリアイコン更新

## 実装アプローチ

確定済みの`tmp/subbuddy_recraft_2.svg`から16・32・48pxの不透明PNGを生成し、3画像を内包する`apps/web/src/app/favicon.ico`へまとめる。SVGを入力にすることで、小サイズ化する前の輪郭を保持する。

同じSVGを1024pxの正本PNGへ変換し、そこからApp Iconの各指定寸法へ縮小する。既存ファイル名と`Contents.json`を維持するため、Xcode設定の変更は不要。

正本PNGを`apps/ios/scripts/assets/`へ置く。生成スクリプトはiOS開発環境であるMacの標準コマンド`sips`を使い、正本から一時ディレクトリへ全画像を生成できた場合だけAsset Catalogへ反映する。これにより途中失敗時の部分更新と、旧アイコンへの巻き戻りを防ぐ。

## 変更するコンポーネント

| コンポーネント / ファイル | 変更内容 | 対応する受け入れ条件 |
|---|---|---|
| `apps/web/src/app/favicon.ico` | 16・32・48pxを内包するICOへ置換 | AC-1, AC-4 |
| `apps/ios/SubBuddyApp/Assets.xcassets/AppIcon.appiconset/*.png` | 18サイズの画像を新デザインへ置換 | AC-2, AC-3, AC-4 |
| `Contents.json` | 変更なし。検証にのみ使用 | AC-3, AC-5 |
| `apps/ios/scripts/assets/app-icon-source-1024.png` | 再生成用の正本PNGを更新 | AC-4, AC-6 |
| `apps/ios/scripts/generate-app-icons.mjs` | 正本PNGを`sips`で18サイズへ変換 | AC-2, AC-3, AC-6 |

## データ構造の変更

なし。

## 影響範囲の分析

- `docs/`への影響: 基本設計の変更ではないため更新不要。
- 既存コード・既存機能への影響: Web・iOSアプリ本体にはなし。iOSアイコン生成スクリプトの実行環境はMacに限定する。
- 後方互換 / マイグレーション: 不要。

## 設計上の前提

- Asset Catalogの既存18スロットを維持する。
- ICOは主要ブラウザが解釈できるPNG圧縮画像を16・32・48pxの順で内包する。
- 画像縮小時に縦横比を変えない。
- 端末側で旧アイコンがキャッシュされる場合は、アプリの再インストールで確認する。
- `sips`はiOS開発に使用するMacの標準コマンドとして利用できる。
