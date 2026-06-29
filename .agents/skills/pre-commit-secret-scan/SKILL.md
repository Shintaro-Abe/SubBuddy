---
name: pre-commit-secret-scan
description: >
  git commit を実行する前にワーキングツリー全体を gitleaks でスキャンし、シークレット・APIキー・
  IPアドレス・個人情報（メールアドレス・電話番号）が含まれていないかを検査するスキル。
  ユーザーが「コミット」「commit」「git commit」「変更を保存」などと言ったとき、
  または Claude が git commit コマンドを実行しようとするとき、必ずこのスキルを最初に使うこと。
  問題が検出された場合はコミットを中止し、該当箇所を出力する。インストール確認は初回のみ実施する。
---

# Pre-Commit Secret Scanner

git commit を実行する前に、以下の手順を必ず順番通りに実行すること。

---

## Step 1: gitleaks のインストール確認

フラグファイル `~/.codex/.gitleaks_confirmed` が存在するか確認する。

```bash
test -f ~/.codex/.gitleaks_confirmed && echo "confirmed" || echo "not confirmed"
```

**"confirmed" の場合**: このステップをスキップして Step 2 へ進む（インストール確認は不要）。

**"not confirmed" の場合**: gitleaks が使えるか確認する。

```bash
gitleaks version
```

- **成功した場合**: フラグを作成して Step 2 へ。
  ```bash
  touch ~/.codex/.gitleaks_confirmed
  ```

- **失敗した場合（コマンドが見つからない）**: 以下でインストールする。
  ```bash
  LATEST=$(curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
    | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
  curl -sSfL \
    "https://github.com/gitleaks/gitleaks/releases/download/v${LATEST}/gitleaks_${LATEST}_linux_x64.tar.gz" \
    | tar -xz -C /tmp gitleaks
  sudo mv /tmp/gitleaks /usr/local/bin/gitleaks
  touch ~/.codex/.gitleaks_confirmed
  ```

---

## Step 2: カスタム設定ファイルの確認

リポジトリルートに `.gitleaks.toml` が存在するか確認する。

```bash
test -f .gitleaks.toml && echo "exists" || echo "missing"
```

**"exists" の場合**: Step 3 へ進む。

**"missing" の場合**: git リポジトリのルートを特定し、スキルの assets からコピーする。

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cp "${REPO_ROOT}/.agents/skills/pre-commit-secret-scan/assets/gitleaks.toml" "${REPO_ROOT}/.gitleaks.toml"
```

コピーが成功したか確認する。

```bash
test -f .gitleaks.toml && echo "ok" || echo "failed"
```

**"failed" の場合**: ここで必ず停止する。独自の判断でスキャン方法を変えてはならない。
ユーザーに以下を伝えて終了する:
「`.gitleaks.toml` の設置に失敗しました。`.agents/skills/pre-commit-secret-scan/assets/gitleaks.toml` が存在するか確認してください。コミットは中止します。」

`.gitleaks.toml` は git 管理対象にすること（プロジェクト全体でルールを共有するため）。

---

## Step 3: スキャン実行

```bash
gitleaks detect --no-git --config .gitleaks.toml
```

- `--no-git`: git の追跡状態に関わらずワーキングツリー全ファイルをスキャンする
- `--config`: カスタムルール（IPアドレス・個人情報）を含む設定ファイルを使用する

---

## Step 4: 結果に応じた処理

**終了コード 0（検出なし）**:
ユーザーに「スキャン完了: 機密情報は検出されませんでした」と伝え、git commit を実行する。

**終了コード 1（問題検出）**:
- gitleaks の出力をそのまま表示する（ファイルパス・行番号・検出内容が含まれる）
- **git commit は実行しない**
- ユーザーに以下を伝える:
  「機密情報が検出されました。上記の箇所を確認・修正してから再度コミットしてください。」
- 修正後にユーザーから再度コミットを依頼されたら Step 3 から再実行する
