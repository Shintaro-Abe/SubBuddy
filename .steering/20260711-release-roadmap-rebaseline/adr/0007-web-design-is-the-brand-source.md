---
status: accepted
---

# Web版のデザインをブランドの正本とする

SubBuddyの色、書体の役割、余白、情報の強弱、中立的な表現は、`.steering/20260618-web-ui-implementation`で確定したWeb版を正本とし、iPhoneへ同じ世界観を移す。WebのCSSやレイアウトをそのまま模倣せず、SwiftUI標準の操作、Dynamic Type、VoiceOverを守るiOS用トークンへ対応付ける。

## Consequences

- 背景は暖色オフホワイト、文字は墨、主アクセントはセージとし、琥珀・テラコッタ・赤・グレーは意味のある状態だけに使う。
- Shippori Mincho、Zen Kaku Gothic New、BIZ UDPGothicの役割をiPhoneでも維持する。導入前に配布ライセンス、アプリ容量、日本語表示、Dynamic Type時の可読性を確認する。
- iPhoneのナビゲーション、フォーム、確認操作、基本アイコンはSwiftUIとSF Symbolsを優先し、Web固有のサイドバーやCSS部品を持ち込まない。
- WebとiPhoneのデザイントークン対応表を作り、片方だけ別ブランドに見える変更を防ぐ。
