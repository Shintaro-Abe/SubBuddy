# iOS同梱フォント

Web版の`apps/web/src/app/globals.css`を正本として、Google Fonts公式リポジトリの配布ファイルを2026-07-17に取得した。

| 役割 | フォント | 同梱ファイル | SHA-256 |
|---|---|---|---|
| 本文・見出し | Zen Kaku Gothic New | `ZenKakuGothicNew-Regular.ttf` | `b840cd07a67d89cacca44249ae49aa99ee7640eb5ce623be8d8983d6aabac801` |
| 本文・見出し（太字） | Zen Kaku Gothic New | `ZenKakuGothicNew-Bold.ttf` | `0081cedabc4921982fcd061f845a005664ac7fb642af2dd34b4007bc63ccd235` |
| 大見出し | Shippori Mincho | `ShipporiMincho-SemiBold.ttf` | `bc7925544894a91466449adb73c6d943f50c3e53eb1c74d0673fe2dbafcd4d2d` |
| 金額・主要数値 | BIZ UDPGothic | `BIZUDPGothic-Regular.ttf` | `258d7156c165f2ff774b6efee637c22c3b950de0d8a10e501137061bc8085d01` |
| 金額・主要数値（太字） | BIZ UDPGothic | `BIZUDPGothic-Bold.ttf` | `30eba52fc837e8b62c97d4b82e6706583149fb7294e3712dd71a655eaea80a90` |
| 大見出し内の欧文数値 | EB Garamond | `EBGaramond[wght].ttf` | `ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027` |

取得元:

- `https://github.com/google/fonts/tree/main/ofl/zenkakugothicnew`
- `https://github.com/google/fonts/tree/main/ofl/shipporimincho`
- `https://github.com/google/fonts/tree/main/ofl/bizudpgothic`
- `https://github.com/google/fonts/tree/main/ofl/ebgaramond`

各フォントはSIL Open Font License 1.1で配布される。ライセンス本文は`../FontLicenses/`に保持し、フォントを更新するときは配布元、ライセンス、登録名、ハッシュ、iOS buildを再確認する。
