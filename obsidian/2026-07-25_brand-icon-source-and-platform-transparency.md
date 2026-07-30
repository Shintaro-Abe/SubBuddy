# MUDASKブランドアイコンの正本と透過条件

> 観測日：2026-07-25
> 適用範囲：Web、iPhone・iPad
> 仕様の正本：`docs/development-guidelines.md`、`docs/repository-structure.md`
> 作業記録：`.steering/20260725-refresh-app-icons/`

## 結論

WebとiOSのブランド画像は、`apps/ios/scripts/assets/app-icon-source.svg`を共通の正本とする。デザインは共通だが、透明度はプラットフォームごとに変える。

- Webファビコン：全面背景を除き、16・32・48pxの透過PNGをICOへ内包する。
- iPhone・iPad App Icon：全面背景を残し、透明部分のないPNGをAsset Catalogの18サイズへ生成する。
- iOS再生成用：不透明な`app-icon-source-1024.png`を維持する。

Web用の背景透過を正本SVGへ直接反映すると、iOS用画像まで透明になる。正本は不透明背景を含む状態で保持し、Webの派生生成時だけ全面背景を除く。

## 現行コード参照

- Web：`apps/web/src/app/favicon.ico`
- 共通SVG正本：`apps/ios/scripts/assets/app-icon-source.svg`
- iOS再生成用PNG：`apps/ios/scripts/assets/app-icon-source-1024.png`
- iOS派生画像：`apps/ios/SubBuddyApp/Assets.xcassets/AppIcon.appiconset/`
- Asset Catalog対応表：`apps/ios/SubBuddyApp/Assets.xcassets/AppIcon.appiconset/Contents.json`

## 検証境界

2026-07-25に次を確認した。

- SVGにスクリプト、イベント属性、外部画像参照がない。
- Web ICOの3画像はsRGBで、背景alphaが0、キャラクター部分alphaが255。
- iOSの18画像と1024px正本PNGは、指定寸法、PNG、sRGB、不透明RGB。
- Web本番buildが合格。
- 16px・20pxでキャラクターと貯金箱を識別できる。

未確認はRender反映後のブラウザ表示、Xcode build、Simulator・iPhone実機ホーム画面、端末キャッシュ更新である。これらは`manuals/web-mobile-ui-check.md`と`manuals/ios-ui-quality-check.md`で確認する。

## 更新時の注意

- WebとiOSを別デザインにしない。
- iOS App Iconへ透明PNGを入れない。
- Webファビコンへ全面背景を戻さない。
- 画像ファイル名だけでなく、寸法、色空間、alpha、`Contents.json`との対応を確認する。
- 実在のアカウント、端末識別子、契約、利用量を画像検証へ使わない。
