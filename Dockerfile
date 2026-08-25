# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.4.0
ARG MODULE_SOURCE=workspace

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# Prune from the ordinary build context. Workspace builds use these Module
# bytes; registry builds replace them transactionally from the revision-pinned
# public archive before the Store build begins.
FROM base AS prepare
COPY . .
RUN bunx turbo@2.10.11 prune \
	store \
	@86d-app/internals-generators \
	@86d-app/internals-registry \
	--docker

FROM base AS deps
COPY --from=prepare /app/out/json/ ./
COPY --from=prepare /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS source-base
COPY --from=prepare /app/out/full/ ./
# Templates are runtime inputs, not a package dependency, so Turbo does not
# include them in the pruned workspace closure.
COPY --from=prepare /app/templates ./templates
# Generator and seed helpers share this non-workspace root utility.
COPY --from=prepare /app/internals/lib ./internals/lib
# Package TypeScript configs extend this non-workspace root config.
COPY --from=prepare /app/tsconfig.base.json ./tsconfig.base.json
# Docker build and runner layout assertions are not workspace dependencies.
COPY --from=prepare /app/internals/docker/verify-runtime-contract.ts ./internals/docker/verify-runtime-contract.ts

FROM source-base AS module-source-workspace
RUN bun internals/generators/src/generate-modules.ts --frozen

# Production builds fetch every selected official Module from the injected,
# revision-pinned public manifest. The grouped fetch downloads one public
# archive for the repository and needs no build-time credential.
FROM source-base AS module-source-registry
ARG SOURCE_REVISION
RUN set -eu; \
	if [ -z "${SOURCE_REVISION}" ]; then \
		echo "SOURCE_REVISION is required when MODULE_SOURCE=registry" >&2; \
		exit 1; \
	fi; \
	# Module directories span lower Docker layers after prune and install. Copy
	# them up before the registry fetch transaction so sibling renames remain
	# atomic on overlayfs instead of failing with EXDEV. \
	cp -a /app/modules /app/.registry-modules; \
	rm -rf /app/modules; \
	mv /app/.registry-modules /app/modules; \
	env \
		"86D_REGISTRY_ONLY_MODULES=true" \
		"86D_REGISTRY_SOURCE_REVISION=${SOURCE_REVISION}" \
		bun internals/generators/src/generate-modules.ts --frozen

# Select exactly one source stage. Valid values are `workspace` and `registry`.
FROM module-source-${MODULE_SOURCE} AS builder
ARG TARGETARCH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

# The public Store resolves exactly the 100 public Module packages. Keep the
# package-name set as a build-only trace policy for whole-runner validation.
RUN bun internals/docker/verify-runtime-contract.ts \
	module-manifest modules runtime/module-package-names.json

# Bun on Linux arm64 can return 139 after Next has fully emitted its output;
# accept only that exact case and only with a complete standalone tree.
RUN set +e; \
	better_auth_secret="$(bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64"))')"; \
	BETTER_AUTH_SECRET="${better_auth_secret}" \
	BETTER_AUTH_URL="http://127.0.0.1:3000" \
	APP_URL="http://127.0.0.1:3000" \
	NODE_OPTIONS="--max-old-space-size=4096" \
	bun run build:store; \
	status=$?; \
	set -e; \
	if ! bun internals/docker/verify-runtime-contract.ts next-build apps/store/.next; then \
		if [ "${status}" -ne 0 ]; then exit "${status}"; fi; \
		exit 1; \
	fi; \
	if [ "${status}" -eq 0 ]; then exit 0; fi; \
	if [ "${TARGETARCH}" = "arm64" ] && [ "${status}" -eq 139 ]; then \
		echo "Accepting Bun arm64 status 139 after complete standalone output" >&2; \
		exit 0; \
	fi; \
	exit "${status}"

# Stage the seed/DDL runtime contract after Module generation. This deliberately
# emits only 22 relational `src/schema.ts` files; Stripe is curated tier-none.
RUN bun -e 'import { stageCuratedModuleSchemas } from "./packages/db/src/stage-curated-modules.ts"; await stageCuratedModuleSchemas({ sourceModulesRoot: "./modules", destinationModulesRoot: "./runtime/modules" });'

# Sanitize every builder snapshot copied into the runner so authoring artifacts
# never enter a final-image layer.
RUN set -eu; \
	standalone_root="apps/store/.next/standalone"; \
	pg_alias_count=0; \
	for pg_alias in "${standalone_root}"/apps/store/.next/node_modules/pg-*; do \
		if [ ! -L "${pg_alias}" ]; then continue; fi; \
		case "$(readlink "${pg_alias}")" in \
			*node_modules/.bun/pg@*/node_modules/pg) ;; \
			*) echo "Unexpected standalone pg alias target: ${pg_alias}" >&2; exit 1 ;; \
		esac; \
		ln -sfn ../../../../node_modules/pg "${pg_alias}"; \
		pg_alias_count=$((pg_alias_count + 1)); \
	done; \
	if [ "${pg_alias_count}" -ne 1 ]; then \
		echo "Expected exactly one standalone pg external alias" >&2; \
		exit 1; \
	fi; \
	for dependency in \
		drizzle-kit drizzle-orm pg pg-cloudflare pg-connection-string pg-int8 pg-pool \
		pg-protocol pg-types pgpass postgres-array postgres-bytea postgres-date \
		postgres-interval split2 xtend zod \
		@86d-app/core @86d-app/db @86d-app/storage db env; do \
		find "${standalone_root}" \
			-path "*/node_modules/${dependency}" \
			-prune -exec rm -rf '{}' +; \
	done; \
	find \
		"${standalone_root}" \
		packages/core/src \
		packages/storage/src \
		packages/env/src \
		-depth -type d \( \
			-name __fixtures__ -o -name __specs__ -o -name __tests__ -o \
			-name fixture -o -name fixtures -o -name spec -o -name specs -o \
			-name test -o -name tests \
		\) -exec rm -rf '{}' +; \
	find \
		"${standalone_root}" \
		packages/core/src \
		packages/storage/src \
		packages/env/src \
		-type f \( \
			-name '*.fixture.*' -o -name '*.fixture-*' -o \
			-name '*.spec.*' -o -name '*.spec-*' -o \
			-name '*.test.*' -o -name '*.test-*' \
		\) -delete; \
	if [ -d "${standalone_root}/node_modules/.bun" ]; then \
		find "${standalone_root}/node_modules/.bun" -depth -type d -empty -delete; \
	fi

# Export the exact migration/seed closure from the pruned frozen install. Every
# package below therefore comes from the committed lock instead of a second,
# independently resolved install.
FROM deps AS runtime-deps
RUN set -eu; \
	mkdir -p /export; \
	copy_dependency() { \
		source_path="$1"; \
		dependency="$2"; \
		if [ ! -e "${source_path}" ]; then \
			echo "Missing frozen runtime dependency ${dependency}" >&2; \
			exit 1; \
		fi; \
		cp -aL "${source_path}" "/export/${dependency}"; \
	}; \
	for dependency in drizzle-kit drizzle-orm pg; do \
		copy_dependency "packages/db/node_modules/${dependency}" "${dependency}"; \
	done; \
	copy_dependency node_modules/zod zod; \
	pg_node_modules="$(dirname "$(readlink -f packages/db/node_modules/pg)")"; \
	for dependency in \
		pg-cloudflare pg-connection-string pg-pool \
		pg-protocol pg-types pgpass; do \
		copy_dependency "${pg_node_modules}/${dependency}" "${dependency}"; \
	done; \
	pg_types_node_modules="$(dirname "$(readlink -f "${pg_node_modules}/pg-types")")"; \
	for dependency in \
		pg-int8 postgres-array postgres-bytea postgres-date postgres-interval; do \
		copy_dependency "${pg_types_node_modules}/${dependency}" "${dependency}"; \
	done; \
	pgpass_node_modules="$(dirname "$(readlink -f "${pg_node_modules}/pgpass")")"; \
	copy_dependency "${pgpass_node_modules}/split2" split2; \
	interval_node_modules="$(dirname "$(readlink -f "${pg_types_node_modules}/postgres-interval")")"; \
	copy_dependency "${interval_node_modules}/xtend" xtend; \
	find /export -depth -type d \( \
		-name __fixtures__ -o -name __specs__ -o -name __tests__ -o \
		-name fixture -o -name fixtures -o -name spec -o -name specs -o \
		-name test -o -name tests \
	\) -exec rm -rf '{}' +; \
	find /export -type f \( \
		-name '*.fixture.*' -o -name '*.fixture-*' -o \
		-name '*.spec.*' -o -name '*.spec-*' -o \
		-name '*.test.*' -o -name '*.test-*' \
	\) -delete

FROM oven/bun:${BUN_VERSION}-slim AS runner-base
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STORAGE_CLIENT=local
ENV STORAGE_LOCAL_DIR=/app/uploads
ENV STORAGE_LOCAL_BASE_URL=/uploads
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && \
	useradd --system --uid 1001 --gid nodejs nextjs

# Next standalone application and runtime-resolved template assets.
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/.next/static ./apps/store/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/public ./apps/store/public
COPY --from=builder --chown=nextjs:nodejs /app/templates ./templates

# Migration and deterministic seed inputs.
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src/seed.ts ./packages/db/src/seed.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src/load-curated-modules.ts ./packages/db/src/load-curated-modules.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src/schema ./packages/db/src/schema
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/seed/catalog ./packages/db/seed/catalog
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/seed/assets ./packages/db/seed/assets
COPY --from=builder --chown=nextjs:nodejs /app/runtime/modules ./modules

# Source packages used by seed and curated schema loading. Copy source-only
# subtrees to avoid carrying workspace caches, tests' dependencies, or builds.
COPY --from=builder --chown=nextjs:nodejs /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/core/src ./packages/core/src
COPY --from=builder --chown=nextjs:nodejs /app/packages/storage/package.json ./packages/storage/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/storage/src ./packages/storage/src
COPY --from=builder --chown=nextjs:nodejs /app/packages/env/package.json ./packages/env/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/env/src ./packages/env/src
COPY --from=prepare --chown=nextjs:nodejs /app/internals/lib ./internals/lib
COPY --from=prepare --chown=nextjs:nodejs /app/internals/docker/init.sql ./internals/docker/init.sql
COPY --from=prepare --chown=nextjs:nodejs /app/package.json ./package.json

# Fail before copying if Next unexpectedly traced a dependency that belongs to
# the exact migration/seed runtime closure.
RUN set -eu; \
	mkdir -p ./node_modules; \
	for dependency in \
		drizzle-kit drizzle-orm pg pg-cloudflare pg-connection-string pg-int8 pg-pool \
		pg-protocol pg-types pgpass postgres-array postgres-bytea postgres-date \
		postgres-interval split2 xtend zod; do \
		if [ -e "./node_modules/${dependency}" ] || [ -L "./node_modules/${dependency}" ]; then \
			echo "Standalone unexpectedly contains runtime dependency ${dependency}" >&2; \
			exit 1; \
		fi; \
	done

# Copy the frozen migration/seed closure directly into its final location so it
# enters the image once and does not need a temporary bind or cleanup layer.
COPY --from=runtime-deps --chown=nextjs:nodejs /export/ ./node_modules/
RUN set -eu; \
	mkdir -p ./node_modules/@86d-app; \
	for dependency in \
		@86d-app/core @86d-app/db @86d-app/storage db env; do \
		if [ -e "./node_modules/${dependency}" ] || [ -L "./node_modules/${dependency}" ]; then \
			echo "Standalone unexpectedly contains runtime link ${dependency}" >&2; \
			exit 1; \
		fi; \
	done; \
	ln -s ../../packages/core ./node_modules/@86d-app/core; \
	ln -s ../../packages/db ./node_modules/@86d-app/db; \
	ln -s ../../packages/storage ./node_modules/@86d-app/storage; \
	ln -s ../packages/db ./node_modules/db; \
	ln -s ../packages/env ./node_modules/env

COPY --from=prepare --chown=nextjs:nodejs --chmod=755 /app/internals/docker/entrypoint.sh /app/entrypoint.sh
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Audit in a throwaway descendant so the verifier and package-name manifest do
# not enter any layer of the final runtime image. The final stage depends only
# on the zero-content success marker emitted after the audit passes.
FROM runner-base AS runner-audit
COPY --from=prepare /app/internals/docker/verify-runtime-contract.ts /app/internals/docker/verify-runtime-contract.ts
COPY --from=builder /app/runtime/module-package-names.json /app/internals/docker/module-package-names.json
RUN set -eu; \
	bun internals/docker/verify-runtime-contract.ts \
		runner /app /app/internals/docker/module-package-names.json; \
	touch /runtime-layout-verified

FROM runner-base AS runner
COPY --from=runner-audit /runtime-layout-verified /runtime-layout-verified

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
	CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{const body=await r.json();if(!r.ok||body.status!=='healthy'||body.checks?.database!=='ok'||body.checks?.storage!=='ok')process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
