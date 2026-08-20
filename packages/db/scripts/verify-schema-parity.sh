#!/bin/sh
# Prove the Drizzle schema builds the same database the Prisma schema did.
#
# Builds two throwaway databases — one from `prisma migrate diff`, one from the
# generated Drizzle migration — and diffs their catalogs: every column with its
# type, length, precision, nullability and default; every index with its full
# definition; every constraint.
#
# Expected output is the two UNIQUE constraints on Module. Prisma declared those
# as bare unique indexes, which Postgres emits after every foreign key, so the
# three composite outbox keys that reference them could not be created. As
# constraints they are created with the table. Same backing indexes, and the
# foreign keys resolve.
#
# Any other line is drift. Investigate before shipping it.
set -e

CONTAINER=86d-schema-parity
PORT=55432
DB_URL_BASE="postgresql://postgres:postgres@localhost:${PORT}"
HERE=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)

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

echo "→ Rendering the Prisma schema to DDL"
(cd "$HERE" && bunx prisma migrate diff --from-empty --to-schema prisma --script) \
	>"$WORK/prisma.sql" 2>/dev/null

cat >"$WORK/catalog.sql" <<'SQL'
\pset tuples_only on
\pset format unaligned
SELECT 'COLUMN|' || table_name || '|' || column_name || '|' || data_type || '|' ||
       coalesce(character_maximum_length::text, '-') || '|' ||
       coalesce(numeric_precision::text, '-') || '|' ||
       coalesce(datetime_precision::text, '-') || '|' ||
       is_nullable || '|' || coalesce(column_default, '-')
FROM information_schema.columns WHERE table_schema = 'public';
SELECT 'INDEX|' || indexname || '|' || regexp_replace(indexdef, '\s+', ' ', 'g')
FROM pg_indexes WHERE schemaname = 'public';
SELECT 'CONSTRAINT|' || conrelid::regclass::text || '|' || conname || '|' ||
       pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
SQL

docker cp "$HERE/../../internals/docker/init.sql" "$CONTAINER:/tmp/init.sql" >/dev/null
docker cp "$WORK/prisma.sql" "$CONTAINER:/tmp/prisma.sql" >/dev/null
docker cp "$HERE/drizzle/0000_baseline.sql" "$CONTAINER:/tmp/drizzle.sql" >/dev/null
docker cp "$WORK/catalog.sql" "$CONTAINER:/tmp/catalog.sql" >/dev/null

for pair in "prisma_side:/tmp/prisma.sql" "drizzle_side:/tmp/drizzle.sql"; do
	name=${pair%%:*}
	file=${pair#*:}
	docker exec "$CONTAINER" psql -U postgres -q -c "CREATE DATABASE $name" >/dev/null
	docker exec "$CONTAINER" psql -U postgres -d "$name" -q -f /tmp/init.sql >/dev/null 2>&1
	errors=$(docker exec "$CONTAINER" psql -U postgres -d "$name" -f "$file" 2>&1 |
		grep -ci error || true)
	if [ "$errors" != "0" ]; then
		echo "✗ $name applied with $errors errors"
		docker exec "$CONTAINER" psql -U postgres -d "$name" -f "$file" 2>&1 | grep -i error
		exit 1
	fi
	docker exec "$CONTAINER" psql -U postgres -d "$name" -f /tmp/catalog.sql 2>/dev/null |
		sort >"$WORK/$name.txt"
done

echo "→ Catalog difference (Drizzle relative to Prisma)"
diff "$WORK/prisma_side.txt" "$WORK/drizzle_side.txt" || true
echo "✓ Both schemas applied without error"
