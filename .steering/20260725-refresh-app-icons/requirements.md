# 要求内容 — Web・iPhoneアプリアイコン再更新

## 背景・目的

利用者が指定した新しい画像を、MUDASKのWebファビコンとiPhone・iPadのアプリアイコンへ統一して反映する。

## 変更内容

- `tmp/kawaii-mobile-app-icon-illustration-of-a-cute-chub.svg`からWebファビコンを生成して置き換える。
- 同じSVGから、既存Asset Catalogが要求する18サイズのPNGと再生成用1024px画像を生成して置き換える。
- 新しいSVGを再生成用の正本として追跡対象へ移す。
- 旧デザインの画像データと、追跡されていない旧favicon生成物を削除する。
- アプリの機能、画面、表示名、Bundle ID、Target、Schemeは変更しない。

## 受け入れ条件

- [x] AC-1: Webファビコンが指定SVG由来の新画像になっている。
- [x] AC-2: App Icon 18画像が指定SVG由来の新画像になっている。
- [x] AC-3: App Iconの寸法が`Contents.json`のsize・scaleと一致する。
- [x] AC-4: Webファビコンの背景が透過し、iOS用画像は不透明で、小サイズでも主要な形を識別できる。
- [x] AC-5: 再生成用の正本が新画像へ切り替わり、旧画像へ戻らない。
- [x] AC-6: アプリのコード、設定、データ、内部識別子に意図しない変更がない。

## 制約事項

- 実在のPII・機微データは扱わない。
- iOSが表示時に角丸マスクを適用するため、元画像へ角丸を加えない。
- Webは透過PNGを内包する既存と同じICO、App Iconは不透明な既存PNGファイル構成を維持する。
