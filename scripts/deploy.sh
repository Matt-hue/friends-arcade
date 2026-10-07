#!/usr/bin/env bash
# Deploy the stack on the server. Run from anywhere as SERVER_USER.
# Usage: scripts/deploy.sh [service]   (no argument = all services)
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE="${1:-}"
HEALTH_TIMEOUT=180

echo "==> Validating compose file"
docker compose config --quiet

echo "==> Pulling images ${SERVICE:+for $SERVICE}"
# shellcheck disable=SC2086
docker compose pull ${SERVICE}

echo "==> Starting ${SERVICE:-all services}"
# shellcheck disable=SC2086
docker compose up -d --remove-orphans ${SERVICE}

echo "==> Waiting for healthy containers (timeout ${HEALTH_TIMEOUT}s)"
deadline=$((SECONDS + HEALTH_TIMEOUT))
while true; do
	bad=()
	# shellcheck disable=SC2086
	while read -r name; do
		[[ -z $name ]] && continue
		status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name")
		if [[ $status != "healthy" && $status != "running" ]]; then
			bad+=("$name=$status")
		fi
	done < <(docker compose ps --format '{{.Name}}' ${SERVICE})
	if [[ ${#bad[@]} -eq 0 ]]; then
		echo "All services healthy."
		break
	fi
	if ((SECONDS >= deadline)); then
		echo "ERROR: unhealthy after ${HEALTH_TIMEOUT}s: ${bad[*]}" >&2
		docker compose ps >&2
		exit 1
	fi
	sleep 5
done

echo "==> Pruning unused images"
docker image prune -af >/dev/null

echo "==> Disk usage"
df -h /
usage=$(df --output=pcent / | tail -n1 | tr -dc '0-9')
if ((usage > 80)); then
	echo "WARNING: root filesystem is ${usage}% full (over 80%)" >&2
fi
