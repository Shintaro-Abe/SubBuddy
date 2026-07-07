---
status: accepted
---

# Apple サインインの token 検証を aud 許可リスト方式にする

iOS はネイティブ Sign in with Apple を使い、Web は Services ID を使うため、Apple が返す identity token の `aud`（宛先）は iOS＝アプリ Bundle ID（`com.subbuddy.app`）、Web＝Services ID（`com.subbuddy.web`）と値が変わる。サーバーの Apple token 検証は、署名検証・`iss = https://appleid.apple.com` に加えて `aud ∈ { com.subbuddy.web, com.subbuddy.app }` を許可リストで検証し、Web と iOS を同一 `users`（`sub` ハッシュで解決、メールは必須にしない）へ集約する。iOS 用はネイティブ検証専用エンドポイント（例：`POST /api/auth/apple/native`）を設け、Web のリダイレクト用コールバックと処理を分離する。

## Considered Options

- iOS も Web の OAuth リダイレクト（Services ID）で通す：iOS のネイティブサインイン推奨・審査・UX で不利。ネイティブ資産（Spike）とも噛み合わないため棄却。
- iOS 用に別の `users` 名前空間を作る：同一ユーザーの Web と iOS が別アカウントになり、テナント/データ集約方針と衝突するため棄却。

## Consequences

- 許可する `aud` を1つに固定できないため、許可リストの管理と監査（想定外 `aud` を受け入れない）が必要。
- 対応プラットフォーム追加時は許可リストを見直す。
