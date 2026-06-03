#!/usr/bin/env bash
# ローカル開発用 PostgreSQL を用意する（合成データ専用）。
# devcontainer に docker が無い前提で、apt の PostgreSQL を使う。
# 実データ・本番資格情報は扱わない（CLAUDE.md PII 方針）。
set -euo pipefail

DB_NAME="${DB_NAME:-subbuddy_dev}"
DB_USER="${DB_USER:-subbuddy}"
DB_PASS="${DB_PASS:-subbuddy}"

echo "==> PostgreSQL の導入確認"
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> サービス起動"
sudo service postgresql start

echo "==> ロール作成（存在すればスキップ）"
sudo bash -c "su postgres -c \"psql -tAc \\\"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\\\"\"" \
  | grep -q 1 \
  || sudo bash -c "su postgres -c \"psql -c \\\"CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'\\\"\""

echo "==> データベース作成（存在すればスキップ）"
sudo bash -c "su postgres -c \"psql -tAc \\\"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\\\"\"" \
  | grep -q 1 \
  || sudo bash -c "su postgres -c \"createdb -O ${DB_USER} ${DB_NAME}\""

echo "==> 接続確認"
PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT current_database(), current_user;"

echo "完了：DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
