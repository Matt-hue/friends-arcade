#!/bin/sh
# Dump every database (custom format, compressed) into $BACKUP_DIR.
# Retention: 3 daily + 2 weekly. Optional S3 upload when S3_* are set.
# Usage: backup.sh          run one backup now
#        backup.sh daemon   run one backup every night at 02:00 UTC
# Expects PGHOST/PGUSER/PGPASSWORD in the environment (set by compose.yaml).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAILY=3
KEEP_WEEKLY=2

# Delete all but the newest $2 files of a given database prefix in directory $1.
prune() {
	dir=$1
	keep=$2
	# Dump names are DB_TIMESTAMP.dump; group by database so each keeps $keep.
	# shellcheck disable=SC2012
	for db in $(ls "$dir" 2>/dev/null | sed 's/_[0-9T]*Z\.dump$//' | sort -u); do
		# shellcheck disable=SC2012
		ls -1t "$dir"/"${db}"_[0-9]*T*Z.dump 2>/dev/null | tail -n +$((keep + 1)) | while read -r old; do
			rm -f -- "$old"
		done
	done
}

# Upload one file to S3-compatible storage using curl's SigV4 support.
upload() {
	file=$1
	if [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_ENDPOINT:-}" ]; then
		return 0
	fi
	if ! command -v curl >/dev/null 2>&1; then
		apk add --no-cache curl >/dev/null
	fi
	prefix="${S3_PREFIX:+${S3_PREFIX%/}/}"
	curl --fail --silent --show-error \
		--user "${S3_ACCESS_KEY}:${S3_SECRET_KEY}" \
		--aws-sigv4 "aws:amz:${S3_REGION:-us-east-1}:s3" \
		--upload-file "$file" \
		"${S3_ENDPOINT%/}/${S3_BUCKET}/${prefix}$(basename "$file")"
	echo "uploaded $(basename "$file") to S3"
}

run_backup() {
	stamp=$(date -u +%Y%m%dT%H%M%SZ)
	mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
	# Every non-template database.
	databases=$(psql -d postgres -At -c "SELECT datname FROM pg_database WHERE NOT datistemplate")
	for db in $databases; do
		file="$BACKUP_DIR/daily/${db}_${stamp}.dump"
		pg_dump -Fc -Z 6 -d "$db" -f "$file.tmp"
		mv "$file.tmp" "$file"
		echo "dumped $db -> $file"
		# Sunday's dump is also kept as the weekly copy.
		if [ "$(date -u +%u)" = "7" ]; then
			cp "$file" "$BACKUP_DIR/weekly/"
		fi
		upload "$file" || echo "WARNING: S3 upload failed for $file" >&2
	done
	prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
	prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
}

if [ "${1:-}" = "daemon" ]; then
	while true; do
		now=$(date -u +%s)
		next=$(((now / 86400) * 86400 + 7200))
		if [ "$next" -le "$now" ]; then
			next=$((next + 86400))
		fi
		sleep $((next - now))
		run_backup || echo "WARNING: backup failed" >&2
	done
else
	run_backup
fi
