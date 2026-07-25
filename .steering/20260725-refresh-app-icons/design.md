# 設計 — Web・iPhoneアプリアイコン再更新

## 実装アプローチ

指定SVGを正本として`apps/ios/scripts/assets/app-icon-source.svg`へ配置する。同じSVGから、不透明な16・32・48px PNGを内包する`apps/web/src/app/favicon.ico`、iOS再生成用1024px PNG、既存Asset Catalogの18サイズを生成する。

既存ファイル名と`Contents.json`を維持し、Xcode設定やWeb metadataの変更を避ける。画像生成後は寸法、形式、透明度、SVGとの由来を機械検証し、代表サイズを目視確認する。

## 変更対象

| 対象                                               | 変更内容                       | 対応AC           |
| -------------------------------------------------- | ------------------------------ | ---------------- |
| `apps/web/src/app/favicon.ico`                     | 16・32・48px内包ICOへ置換      | AC-1, AC-4       |
| `apps/ios/scripts/assets/app-icon-source.svg`      | 指定SVGを正本として追加        | AC-5             |
| `apps/ios/scripts/assets/app-icon-source-1024.png` | 新SVG由来の再生成入力へ置換    | AC-2, AC-4, AC-5 |
| `AppIcon.appiconset/*.png`                         | 既存18画像の内容を置換         | AC-2, AC-3, AC-4 |
| `favicon/`                                         | 追跡されていない旧生成物を削除 | AC-5             |

## 影響範囲

- `docs/`: 基本設計への影響なし。
- Web・iOS機能: 影響なし。表示画像だけを変更する。
- DB・API・認証: 影響なし。
- 後方互換・マイグレーション: 不要。

## 前提・未決事項

- ユーザー指定SVGを確定デザインとして扱う。
- 既存Asset Catalogの18スロットを維持する。
- 未決事項なし。
