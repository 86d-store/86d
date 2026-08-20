# ============================================================================
# 86d Store — Multi-stage Docker Build
# ============================================================================
# Usage:
#   docker build -t 86d-store .
#   docker compose up
# ============================================================================

# ── Stage 1: Install dependencies ──────────────────────────────────────────
FROM oven/bun:1.3.14 AS deps
WORKDIR /app

ENV NODE_ENV=production

# Store image: manifests for the store app, generate-modules (@86d-app/registry),
# @86d-app/runtime, lockfile-listed workspaces (internals/github, packages/cli stubs).
COPY package.json bun.lock ./
# Workspace members referenced by bun.lock (frozen install requires manifests on disk)
COPY internals/github/package.json internals/github/
COPY apps/registry/package.json apps/registry/
COPY internals/generators/package.json internals/generators/
COPY packages/cli/package.json packages/cli/
COPY apps/store/package.json apps/store/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/env/package.json packages/env/
COPY packages/utils/package.json packages/utils/
COPY packages/lib/package.json packages/lib/
COPY packages/emails/package.json packages/emails/
COPY packages/registry/package.json packages/registry/
COPY packages/runtime/package.json packages/runtime/
COPY packages/sdk/package.json packages/sdk/
COPY packages/storage/package.json packages/storage/

# Copy only module package.json files (not source code) for better layer caching
COPY modules/ /tmp/all-modules/
RUN mkdir -p modules && \
    for dir in /tmp/all-modules/*/; do \
      name=$(basename "$dir"); \
      mkdir -p "modules/$name" && \
      cp "$dir/package.json" "modules/$name/package.json" 2>/dev/null || true; \
    done && \
    rm -rf /tmp/all-modules

# Hoisted linker only in Docker: avoids isolated-install resolution issues (e.g. tsc in packages/utils)
# on Linux/Railway; local dev keeps Bun's default workspace linker from bun.lock configVersion.
RUN for attempt in 1 2 3; do \
      bun install --ignore-scripts --frozen-lockfile && exit 0; \
      echo "bun install failed (attempt ${attempt}/3), retrying..." >&2; \
      sleep 2; \
    done; \
    echo "bun install failed after 3 attempts" >&2; \
    exit 1

# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM oven/bun:1.3.14 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN for attempt in 1 2 3; do \
      bun install --ignore-scripts --frozen-lockfile && exit 0; \
      echo "bun install failed (attempt ${attempt}/3), retrying..." >&2; \
      sleep 2; \
    done; \
    echo "bun install failed after 3 attempts" >&2; \
    exit 1

# Generate module imports (run directly with bun — tsx has CJS issues under bun on Linux)
RUN bun internals/generators/src/generate-modules.ts

# Build the store app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true
# next.config imports `env`, which requires a production-strength secret at
# build time. Generate a throwaway value for this RUN only (not an image ENV);
# runtime must supply BETTER_AUTH_SECRET via compose/orchestrator.
# oven/bun images do not ship openssl — use Bun's crypto instead.
RUN BETTER_AUTH_SECRET="$(bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64"))')" \
	NODE_OPTIONS="--max-old-space-size=4096" \
	bun run build:store

# ── Stage 3: Install drizzle-kit for runtime migrations ────────────────────
FROM oven/bun:1.3.14 AS drizzle-installer
WORKDIR /app
RUN echo '{"dependencies":{"drizzle-kit":"0.31.10","drizzle-orm":"0.45.2"}}' > package.json && \
    bun install --ignore-scripts

# ── Stage 3b: Full `pg` tree for seed.ts ───────────────────────────────────
# Standalone image + a lone `pg` copy is missing hoisted deps (e.g. pg-types).
FROM oven/bun:1.3.14 AS pg-export
WORKDIR /app
RUN echo '{"dependencies":{"pg":"8.20.0"}}' > package.json && bun install --ignore-scripts
RUN mkdir -p /export && cd node_modules && \
    for d in pg pg-connection-string pg-int8 pg-pool pg-protocol pg-types pgpass \
      postgres-array postgres-bytea postgres-date postgres-interval xtend; do \
      if [ -e "$d" ]; then cp -aL "$d" "/export/$d"; fi; \
    done

# ── Stage 4: Production runtime ────────────────────────────────────────────
FROM oven/bun:1.3.14-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STORAGE_CLIENT=local
ENV STORAGE_LOCAL_DIR=/app/uploads
ENV STORAGE_LOCAL_BASE_URL=/uploads

# Create non-root user (bun:slim is Debian-based, use groupadd/useradd)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy built artifacts
COPY --from=builder /app/apps/store/.next/standalone ./
COPY --from=builder /app/apps/store/.next/static ./apps/store/.next/static
COPY --from=builder /app/apps/store/public ./apps/store/public

# Copy templates — MDX files are resolved at runtime and not traced by standalone
COPY --from=builder /app/templates ./templates

# Drizzle migrations + config for runtime migrate
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder /app/packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY --from=builder /app/packages/db/src/schema ./packages/db/src/schema

# Merge drizzle-kit + pg into the standalone image without overwriting Next hoists.
COPY --from=drizzle-installer /app/node_modules/drizzle-kit /tmp/drizzle-only/drizzle-kit
COPY --from=drizzle-installer /app/node_modules/drizzle-orm /tmp/drizzle-only/drizzle-orm
COPY --from=pg-export /export /tmp/pg-export
RUN set -e; \
    rm -rf ./node_modules/drizzle-kit ./node_modules/drizzle-orm ./node_modules/pg \
      ./node_modules/pg-connection-string ./node_modules/pg-int8 ./node_modules/pg-pool \
      ./node_modules/pg-protocol ./node_modules/pg-types ./node_modules/pgpass \
      ./node_modules/postgres-array ./node_modules/postgres-bytea ./node_modules/postgres-date \
      ./node_modules/postgres-interval ./node_modules/xtend 2>/dev/null || true; \
    mkdir -p ./node_modules && \
    cp -a /tmp/drizzle-only/. ./node_modules/ && \
    cp -a /tmp/pg-export/. ./node_modules/ && \
    rm -rf /tmp/drizzle-only /tmp/pg-export

# Copy seed script and its dependencies
COPY --from=builder /app/packages/db/src/seed.ts ./packages/db/src/seed.ts
COPY --from=builder /app/packages/db/src/index.ts ./packages/db/src/index.ts
COPY --from=builder /app/packages/db/src/load-curated-modules.ts ./packages/db/src/load-curated-modules.ts
COPY --from=builder /app/packages/db/src/schema ./packages/db/src/schema
COPY --from=builder /app/packages/db/seed ./packages/db/seed
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/modules ./modules
COPY --from=builder /app/internals/lib ./internals/lib
COPY --from=builder /app/internals/docker/init.sql ./internals/docker/init.sql
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/storage ./packages/storage
COPY --from=builder /app/packages/storage/node_modules/zod ./packages/storage/node_modules/zod
COPY --from=builder /app/node_modules/zod ./node_modules/zod
RUN \
    mkdir -p ./node_modules/@86d-app && \
    ln -sfn ../../packages/storage ./node_modules/@86d-app/storage && \
    ln -sfn ../../packages/core ./node_modules/@86d-app/core && \
    ln -sfn ../../packages/db ./node_modules/@86d-app/db && \
    ln -sfn ../../packages/db ./node_modules/db && \
    mkdir -p ./packages/core/node_modules && \
    ln -sfn ../../../node_modules/zod ./packages/core/node_modules/zod

# Ensure curated Module packages can resolve @86d-app/core at seed time
RUN set -e; \
    for dir in ./modules/*/ ; do \
      mkdir -p "$dir/node_modules/@86d-app"; \
      ln -sfn ../../../../packages/core "$dir/node_modules/@86d-app/core"; \
    done

# Copy entrypoint
COPY internals/docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create uploads directory for local storage
RUN mkdir -p /app/uploads && \
    chown -R nextjs:nodejs /app/uploads && \
    chown -R nextjs:nodejs /app/node_modules

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
