#!/usr/bin/env sh
set -eu
mkdir -p ./backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T postgres pg_dump -U school_app -d school_community --format=custom > "./backups/school_community_${stamp}.dump"
find ./backups -type f -name '*.dump' -mtime +14 -delete
printf 'backup created: %s\n' "$stamp"
