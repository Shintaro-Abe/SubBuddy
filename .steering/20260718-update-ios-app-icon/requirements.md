# 要求内容 — Webファビコン・iOSアプリアイコン更新

## 背景・目的

SubBuddyの新しいブランドシンボルを、WebファビコンとiPhone・iPadのアプリアイコンへ統一して反映する。

## 変更内容

- やること: `tmp/subbuddy_recraft_2.svg`から16・32・48pxを内包するICO形式のWebファビコンを生成して置き換える。
- やること: 同じ`tmp/subbuddy_recraft_2.svg`から、既存Asset Catalogが要求する18サイズのPNGを生成して置き換える。
- やること: `Contents.json`の対応関係と画像仕様を検証する。
- やること: iOS生成スクリプトの正本1024px PNGも新しい画像へ変更し、旧アイコンへ戻る再発を防ぐ。
- やらないこと: アプリの機能、画面、Bundle ID、表示名を変更しない。

## ユーザーストーリー

- 利用者として、WebとiPhone・iPadで統一されたSubBuddyのアイコンを見たい。

## 受け入れ条件

- [x] AC-1: Webファビコンが新しいSubBuddyシンボルのICOへ置き換わっている。
- [x] AC-2: AppIcon.appiconsetの18画像が新しいSubBuddyシンボルへ置き換わっている。
- [x] AC-3: 各App Iconのピクセル寸法が`Contents.json`のsize・scaleと一致する。
- [x] AC-4: ICO内の3画像とApp Icon全画像がsRGB・不透明である。
- [x] AC-5: アプリのコード・設定・データに変更がない。
- [x] AC-6: iOS生成スクリプトが新しい正本PNGを入力として使い、旧アイコンへ戻らない。

## 制約事項

- 実在のPII・機微データは扱わない。
- iOS元画像は正方形、角丸なし、透明部分なしとする。
- ファビコンの成果物はICO、App Iconの成果物はPNGとする。
- iOSが表示時に角丸マスクを適用する前提を維持する。
