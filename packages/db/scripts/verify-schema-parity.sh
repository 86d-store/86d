#!/bin/sh
# Prove the Drizzle migration chain applies cleanly on disposable Postgres.
set -e

CONTAINER=86d-schema-parity
PORT=55432
HERE=$(cd "$(dirname "$0")/.." && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK=$(mktemp -d)
DB_URL="postgresql://postgres:postgres@localhost:${PORT}/postgres"

cleanup() {
	docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

echo "→ Starting throwaway Postgres"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres \
	-p "${PORT}:5432" postgres:16 >/dev/null
i=0
until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
	i=$((i + 1))
	[ "$i" -ge 30 ] && { echo "✗ Postgres never became ready"; exit 1; }
	sleep 1
done

echo "→ Applying nanoid bootstrap"
docker cp "$ROOT/internals/docker/init.sql" "$CONTAINER:/tmp/init.sql" >/dev/null
docker exec "$CONTAINER" psql -U postgres -q -f /tmp/init.sql >/dev/null

echo "→ Applying Drizzle migrations via drizzle-kit"
(
	cd "$HERE"
	DATABASE_URL="$DB_URL" bunx drizzle-kit migrate
)

echo "✓ Drizzle migration chain applied without error"
