#!/bin/sh
# Dump the PlayChess database from the Compose project. Does not touch other projects.
# Usage: deploy/backup-postgres.sh [/var/backups/playchess]
set -eu

out_dir="${1:-/var/backups/playchess}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out_dir"

docker compose -p playchess -f /opt/playchess/docker-compose.prod.yml exec -T postgres \
  pg_dump -U playchess --no-owner --format=custom playchess \
  > "$out_dir/playchess-$stamp.dump"

echo "$out_dir/playchess-$stamp.dump"
