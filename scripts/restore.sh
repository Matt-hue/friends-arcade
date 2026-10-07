#!/usr/bin/env bash
# Restore a dump from the backups volume into a named database.
# Run on the server from /opt/stack:
#   scripts/restore.sh                      list available dumps
#   scripts/restore.sh <dump> <database>    restore (asks for confirmation)
# <dump> is a path relative to the backups volume, e.g. daily/myapp_20250101T020000Z.dump
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -eq 0 ]]; then
	docker compose exec -T backup find /backups -name '*.dump' -type f
	exit 0
fi
if [[ $# -ne 2 ]]; then
	echo "Usage: $0 <dump> <database>" >&2
	exit 1
fi

dump=$1
db=$2
if [[ ! $db =~ ^[A-Za-z0-9_]+$ ]]; then
	echo "Invalid database name: $db" >&2
	exit 1
fi
docker compose exec -T backup test -f "/backups/$dump" || {
	echo "Dump not found in backups volume: $dump" >&2
	exit 1
}

echo "This will OVERWRITE database '$db' with $dump."
read -r -p "Type the database name to confirm: " answer
if [[ $answer != "$db" ]]; then
	echo "Aborted."
	exit 1
fi

# Create the database if missing, then restore, dropping existing objects first.
docker compose exec -T backup sh -c \
	"psql -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || createdb '$db'"
docker compose exec -T backup pg_restore --clean --if-exists --no-owner -d "$db" "/backups/$dump"
echo "Restore of $db complete."
