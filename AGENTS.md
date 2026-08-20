# 86d.store Store Runtime (public)

Modular, MIT-licensed commerce Store Runtime. Each Store is single-tenant with its own Storefront, Store Admin, and authoritative commerce data. The Control Plane within 86d.app can provision and operate this product from the sibling `private/` repo; it also runs fully standalone via Docker. See the root `AGENTS.md` for how the areas fit together.

Bun monorepo orchestrated by Turborepo. TypeScript everywhere, strict mode.

In the full workspace, read `../prd/README.md` before changing product behavior, ownership, payments, Checkout, Fulfillment, managed credentials, Modules, or agent surfaces. It defines target behavior. This file and the code describe current implementation. When they differ, implement an explicit migration and preserve standalone operation.

## Get started

```bash
# Docker (recommended, zero configuration)
docker compose up                  # postgres + store on :3000 (auto-migrates, seeds, creates admin)

# Local development
bun install                        # also runs generate:modules (--frozen) via postinstall
bun run generate:modules           # regenerate module imports from config
bun run db:seed                    # seed demo data (requires DATABASE_URL)
bun run dev                        # store dev server on :3000 (do NOT run in a headless cycle)
```

Default admin: `admin@example.com` / `password123`.

## Build, test, CLI

```bash
bun run build                # build everything
bun run typecheck            # TypeScript across all packages
bun run check                # Biome lint + format
bun run test                 # Vitest unit tests
bun run test:e2e             # Playwright E2E (needs a running, seeded store)
bun run generate:modules     # regenerate generated/components.ts + module imports
bun run generate:registry    # regenerate registry.json from module metadata
bun run generate:docs        # regenerate internals/docs/component-api.md
bun run 86d <command>        # the CLI (see below)
bun run bump-version         # shared version bump (see Version policy)
```

## Repository structure

```
apps/
  store/             Next.js storefront + per-store admin
  registry/          registry.json manifest generator and lock file
modules/             100 modules (cart, products, orders, checkout, collections, brands, ...)
packages/
  core/              Module system: isolation boundary, contracts, types, sanitization, test-utils
  runtime/           Store runtime: ModuleRegistry, UniversalDataService
  cli/               CLI tool (dev, init, module, template, generate, status, doctor)
  registry/          Git-based module registry (resolve, fetch, cache)
  storage/           Storage abstraction (local FS, Vercel Blob, S3-compatible)
  db/                Prisma client singleton (PrismaPg adapter)
  auth/              Better Auth (sessions, admin role, 86d.app SSO)
  emails/            React Email + Resend templates
  env/               Zod env validation (includes STORAGE_CLIENT)
  utils/             Logger, rate-limit, url, sanitize (text + HTML)
  lib/               API keys, webhooks, carrier tracking, LLM content
  sdk/               Store config, template loading, API client
templates/
  brisa/             Default store template (config.json, MDX pages, global.css)
tests/e2e/           Playwright E2E (storefront, admin, checkout, dashboard, accessibility, performance, visual)
internals/
  github/            CI composite Actions
  docker/            Docker entrypoint + legacy init.sql
  docs/              generated component-api.md
  generators/        generate-modules, generate-component-docs, bump-version
packages/db/seed/    demo seed catalog, assets, and fetch tooling
Dockerfile           Multi-stage build (deps → build → runtime)
docker-compose.yml   One-command local deployment (postgres + store)
```

The repository contains 12 packages and 100 first-party Modules. Package presence, generated registry metadata, or an existing endpoint does not establish product maturity. Each capability earns Stable through its versioned contract, failure behavior, tests, documentation, and required production smoke evidence. Unproven capabilities remain Beta or Experimental without blocking public access.

## Module system

Every Module currently exports a factory to a Module object with `id`, `version`, `schema`, `endpoints`, and optional `init`. Modules depend **only** on `@86d-app/core`. All database access goes through `ModuleDataService` provided by the runtime, which today reads and writes JSON `ModuleData`. The target Module contract, storage tiers, and compiled DDL are defined in [`../prd/contexts/store-runtime/module-system.md`](../prd/contexts/store-runtime/module-system.md). Target isolation is Postgres roles and published views, not in-process table prohibition.

**Storage authority (current):** JSON `ModuleData` is production storage. Compiled `mod_<moduleId>` tables are a **test/dev shadow** only — dual-read compares JSON to shadow in tests; production boot constructs one data service (`UniversalDataService`). Do **not** apply compiled DDL or run backfill against a Store with merchant data.

The target cross-Module boundary uses typed synchronous capability calls for immediate business decisions and a durable transactional outbox with versioned, idempotent events for completed changes. The current `requires` and `exports` contracts and in-memory event behavior are migration state where they do not meet that boundary.

Admin pages declare a `group` and optional `subgroup` for the 2-level sidebar. Groups: Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, System. Subgroup mapping is centralized in `apps/store/lib/admin-registry.ts`.

```
modules/<name>/src/
  index.ts              Factory + types + admin nav (no `export { … } from` barrels)
  schema.ts             Zod schemas
  controllers.ts        Business logic
  store/endpoints/      Public endpoints
  store/components/     Customer-facing components (.tsx + .mdx)
  admin/endpoints/      Protected endpoints
  admin/components/     Admin UI components (.tsx + .mdx)
```

External-provider Modules include real HTTP integrations, but each provider path must be verified independently before it is called Stable. Missing credentials may hide an optional Integration. A required Checkout decision must instead fail closed or enter an explicitly non-binding review path. Never accept an unsigned webhook, shopper-supplied provider result, or silent provider fallback.

## Template system

Templates live in `templates/<name>/`. The store app resolves them via tsconfig alias `template/*` → `../../templates/brisa/*`. Each template has `config.json` (modules, OKLCH color tokens, logos), `layout.mdx`, `index.mdx`, page MDX files, and `global.css`. Components follow a two-file pattern: `.tsx` (logic) + `.mdx` (presentation); numbered MDX variants (`1.mdx`, `2.mdx`) are alternate designs for the same component.

**Component overrides:** templates override Module components through `templates/<name>/components/index.tsx`. Exported names replace matching Module defaults at render time. `generate:modules` wires this up by spreading `...templateOverrides` last in `generated/components.ts`. **External templates:** `86d template add github:owner/repo`.

## CLI

`bun run 86d <command>` (source: `packages/cli/src/commands/`):

- `dev`, `init`, `status`, `doctor`
- `module create | add | list | search | info | enable | disable`
- `template create | activate | list`
- `generate modules | components`

## Registry

`apps/registry/registry.json` carries per-Module metadata (description, version, category, `requires`, `hasStoreComponents`, `hasAdminComponents`, `hasStorePages`, integrity hash). The resolver loads the manifest locally or from `https://raw.githubusercontent.com/86d-app/86d/main/apps/registry/registry.json`, which is the canonical source. Never assume a local copy is authoritative. The fetcher retries with exponential backoff (maximum 3 attempts, 500 to 2,000 milliseconds). A wildcard includes all registry Modules plus local workspace Modules. `apps/registry/registry.lock.json` caches resolved versions and integrity hashes.

## Deployment modes

- **Docker (self-hosted):** `docker compose up` starts PostgreSQL + store, auto-runs migrations, seeds demo data, creates the admin user, uses local-filesystem blob storage. Set `BETTER_AUTH_SECRET` to a secure random string in production.
- **Managed (Railway or legacy Vercel + Neon):** the Control Plane within 86d.app provisions a dedicated instance with its own database, hosting, and blob storage. The current implementation sets `86D_API_KEY` plus `STORE_ID`; with `86D_API_KEY` present, the Store Runtime pulls managed configuration and enables 86d.app SSO for Store Admin. This static key is migration state. The target uses `86D_STORE_ID`, `86D_API_URL`, and an opaque workload credential exchanged for short-lived scoped tokens.
- **Storage providers:** `STORAGE_CLIENT` = `local` (Docker default), `vercel`, or `s3` (MinIO, AWS S3, R2). See `.env.example`.

## API endpoints

- `GET /api/health`: database connectivity and Store status (Docker `HEALTHCHECK`).
- `POST /api/upload`: file upload (admin only; JPEG, PNG, WebP, GIF, SVG, and PDF; magic-byte validation; SVG XSS checks).
- `DELETE /api/upload`: file deletion (admin only, Store-isolated).
- `GET /uploads/[...path]`: serve local-storage files when `STORAGE_CLIENT=local` (SVGs use restrictive CSP).
- `GET/POST /api/auth/[...all]`: Better Auth handlers (sign-in, sign-up, SSO).
- `ALL /api/[...path]`: Module endpoints (rate-limited, session-authenticated).

## Terminology

- **86d.store** or **Store Runtime** means the deployed open-source product.
- **storefront** means its shopper experience.
- **store admin** means its merchant operating interface.
- **86d.app** means the optional managed product.
- **86d Console** means its human-facing interface.
- **Control Plane** means the architectural authority within 86d.app.
- **feature** describes merchant-facing product behavior.
- **integration** describes a connection to an external provider.
- **module** is the technical packaging unit used in this repository.
- **Connection** is a configured provider relationship used by an Integration.

In merchant copy and published docs, store, business, storefront, store admin, module, feature, and integration are ordinary nouns (sentence case). If a sentence, heading, or nav/title label begins with one of them, capitalize only the first letter of the first word: **Store admin**, **Storefront**, not **Store Admin**. Keep **Store Runtime**, **86d Console**, and code identifiers as written.

Do not use bare “dashboard” or “console” in product language. Use **86d Console** in product copy and `console` for its app, package, and code identifiers.

## Code conventions

- Biome handles formatting and linting in one repo-root pass (`bun run check`). Domains: `next` (all), `react` (recommended), `tailwind`, `turborepo`, `types`; test files also enable `test` and `playwright`. Tailwind class sorting is enforced via `useSortedClasses`.
- No `any`, `@ts-expect-error`, `@ts-ignore`, or `biome-ignore`. Fix the type or the code.
- Module `src/index.ts` must not use `export { … } from` (Biome `noBarrelFile`). Keep the factory and its own declarations in the entry; named package-root exports use import-then-export. Type-only `export type { … } from` is allowed. Consumers still import from `@86d-app/<module>` or the existing `"./*"` subpath map.
- Module imports: `@86d-app/core` (main), `@86d-app/core/client` (React Query), `@86d-app/core/state` (MobX).
- Store app path alias: `~/` for local imports (not bare `lib/`, which conflicts with `packages/lib`).
- Use the `@86d-app/storage` abstraction. Never import `@vercel/blob` directly.
- Tests use `@86d-app/core/test-utils` mock data services. Never hit a real database.

## Security conventions

- **Sanitize all user text** in store endpoints: `.transform(sanitizeText)` from `@86d-app/core` on every user-provided string (names, descriptions, messages, notes, titles).
- **Bound string lengths:** add `.max()` to every string field, even optional ones. **Bound arrays:** `.max()` on every user-input array.
- **Constrain records:** `z.record(z.string().max(100), z.unknown())` with `.refine()` to limit key count on arbitrary metadata.
- **Admin endpoints** are auth-protected at the framework level through `createAdminEndpoint`; no per-endpoint checks are needed.
- **Rate limiting** at the route handler: 120 req/min public, 300 req/min admin, stricter on sensitive endpoints.
- **Rich HTML** fields (page content, blog posts) use `sanitizeHtml()` instead of `sanitizeText()`, in the admin endpoint that accepts the field. Storing sanitized content keeps the render path free of a second pass.
- **Return errors, don't throw:** store endpoints `return { error: "...", status: 404 }` to avoid stack-trace leakage.
- **Never trust client identity:** derive `customerId`/email from `ctx.context.session.user`, never the request body. Never accept trust-elevation flags (e.g. `isVerifiedPurchase`) from clients.
- **Verify ownership** before mutating user-scoped resources (`resource.customerId === session.user.id`); return 404, not 403, to avoid leaking existence.

## Module maturity

A capability may be **Stable**, **Beta**, **Experimental**, or **Deprecated**. Stable requires a real schema and behavior, bounded and authenticated endpoints, complete failure handling, usable Storefront and Store Admin states where applicable, realistic provider fixtures, verified webhook handling, critical-path tests, relevant visual coverage, accurate documentation, and required production smoke evidence. A clean source tree or complete CRUD surface alone is insufficient.

Beta shows one clear warning on first enablement. Experimental requires explicit advanced opt-in. Deprecated prevents new enablement by default and provides a supported transition. Registry generation must eventually record versioned maturity, compatibility, commit SHA, and a hash of the complete Module subtree. Until that migration lands, inspect evidence rather than inferring maturity from current registry fields.

## Testing

**Unit (Vitest):** `bun run test`, with `@86d-app/core/test-utils` mocks. External-provider fixtures must match the real API JSON shape so a broken integration cannot pass.

**E2E (Playwright):** config at `tests/playwright.config.ts`; specs `storefront`, `checkout`, `admin`, `dashboard`, `accessibility`, `performance`, `visual`. Visual regression runs across viewport projects `visual-desktop` (1280×720), `visual-tablet` (768×1024), `visual-mobile` (375×667), in light and dark. Import from `./fixtures/test-fixtures`, not `@playwright/test`. Selectors are always `data-testid`; always `waitForLoadState('networkidle')`, never `waitForTimeout()`. Coverage target: every page route, admin screen, store-facing screen, empty state, and error state.

## Health gates

All five must pass before committing:
1. `bun run typecheck`: zero errors
2. `bun run check`: zero Biome errors. This lints the whole repo in one pass so `internals/`, `tests/`, `templates/`, and root config files are covered, not just package `src/`.
3. `bun run test`: all unit tests pass
4. `bun run build`: successful build
5. `bun run test:e2e`: Playwright E2E against an already running, seeded store

CI (`.github/workflows/ci.yml`) runs `bun check` at the repository root.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) with a required scope. See `CONTRIBUTING.md` for types, scopes, and examples. Hooks enforce the format locally; CI enforces it on pull requests.

## Version policy

All modules and published packages share one version. After committing, run `bun run bump-version`. It self-skips if it bumped within 24 hours; when it bumps, commit as `chore(repo): bump version to X.Y.Z`. Never hand-edit version fields. Run `bunx changeset` when adding a module or making a breaking public API change.

## Detailed docs

- `apps/store/AGENTS.md`: Store app architecture, routes, Store Admin, and theme system.
- `apps/store/EXAMPLES.md`: Module usage examples.
- `templates/brisa/GUIDE.md`: template authoring guide.
- `tests/e2e/AGENTS.md`: E2E patterns, fixtures, and conventions.
