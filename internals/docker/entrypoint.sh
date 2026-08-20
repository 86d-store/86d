#!/bin/sh
set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  86d Store — Starting...                         ║"
echo "╚══════════════════════════════════════════════════╝"

# ── Wait for database ─────────────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
  echo "→ Waiting for database..."
  MAX_RETRIES=30
  RETRY=0
  # Extract host:port from DATABASE_URL
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
  DB_PORT=${DB_PORT:-5432}

  until bun -e "const net = require('net'); const s = net.createConnection({host:'$DB_HOST',port:$DB_PORT}); s.on('connect',()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1))" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
      echo "✗ Database not reachable after ${MAX_RETRIES} attempts"
      exit 1
    fi
    echo "  Waiting for database... (attempt $RETRY/$MAX_RETRIES)"
    sleep 2
  done
  echo "✓ Database is ready"
fi

# ── Run migrations ────────────────────────────────────────────────────────
if [ "$SKIP_MIGRATIONS" != "true" ] && [ -d "packages/db/prisma" ]; then
  echo "→ Running database migrations..."
  cd packages/db
  if [ -d "prisma/migrations" ]; then
    # Migrations carry every model, so deploy is the whole schema story here.
    deploy_out=$(bunx prisma migrate deploy --schema prisma 2>&1) || deploy_failed=1
    printf '%s\n' "$deploy_out"
    if [ -n "${deploy_failed:-}" ]; then
      # Docker's init.sql creates pgcrypto and nanoid(), so `public` is already
      # non-empty on the first deploy and Prisma reports P3005. Migration 0 is
      # that same nanoid function: record it as applied and deploy the rest.
      # Baseline, never `db push` — db push reconciles a difference by dropping
      # whatever the schema does not declare, and a store's data is that
      # difference on every start after the first.
      if printf '%s' "$deploy_out" | grep -q 'P3005'; then
        echo "→ Baselining migration 0 (nanoid already present from init.sql)"
        bunx prisma migrate resolve --applied 0 --schema prisma || {
          echo "✗ Baseline failed"
          exit 1
        }
        bunx prisma migrate deploy --schema prisma || {
          echo "✗ Migration failed after baseline"
          exit 1
        }
      else
        echo "✗ Migration failed"
        exit 1
      fi
    fi
  else
    # No migrations directory: a scratch database being built from the models.
    # This branch never runs from a checkout of this repository, which ships
    # prisma/migrations, and the Dockerfile copies the directory into the image.
    echo "→ No migrations found; building schema from models"
    bunx prisma db push --schema prisma --accept-data-loss 2>&1 || {
      echo "✗ Schema push failed"
      exit 1
    }
  fi
  cd /app
  echo "✓ Migrations complete"
fi

# ── Seed database (only on first run) ─────────────────────────────────────
if [ "$AUTO_SEED" = "true" ] && [ -f "packages/db/src/seed.ts" ]; then
  echo "→ Seeding database..."
  if ! (cd packages/db && bun run seed) 2>&1; then
    echo "✗ Seed failed"
    exit 1
  fi
  echo "✓ Seed complete"
fi

# ── Start the application ─────────────────────────────────────────────────
echo "→ Starting 86d store on port ${PORT:-3000}..."
exec bun run apps/store/server.js
