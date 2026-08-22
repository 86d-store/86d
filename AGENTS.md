# 86d.store Store Runtime (public)

Modular, MIT-licensed commerce Store Runtime. Each Store is single-tenant with its own Storefront, Store Admin, and authoritative commerce data. The Control Plane within 86d.app can provision and operate this product from the sibling `private/` repo; it also runs fully standalone via Docker. See the root `AGENTS.md` for how the areas fit together.

Bun monorepo orchestrated by Turborepo. TypeScript everywhere, strict mode.

## Source of truth

In the full workspace, read `../prd/README.md` before changing product behavior, ownership, payments, Checkout, Fulfillment, managed credentials, Modules, or agent surfaces. It defines target behavior. This file and the code describe current implementation. When they differ, implement an explicit migration and preserve standalone operation.

## Required gates (every slice)

GitHub Setup, Release, and e2e all run `bun install`, which runs `postinstall` → `bun run generate:modules -- --frozen`. If `apps/registry/registry.lock.json` does not match the current Module trees, **every** workflow dies in Setup. This is a gate for all work in this repo, not a CI-only afterthought.

- The lock hashes each Module's source subtree (including `__tests__`). Editing a webhook test, fixture, or `package.json` invalidates that Module's integrity.
- After any change under `modules/`, run `bun run generate:modules` and **commit** the updated `apps/registry/registry.lock.json` in the same slice.
- Before claiming the slice done, prove `bun run generate:modules -- --frozen` exits 0.
- Lint-staged regenerates the lock when staged paths match `modules/**/*.{ts,tsx,json,md,mdx}`. Do not skip hooks. If you change modules outside that glob, regenerate the lock yourself.
- `bun run bump-version` regenerates `apps/registry/registry.json` **and** the lock. Commit both.

Do not treat local `bun run test` / `typecheck` as sufficient. A green local tree with a stale lock still fails GitHub.

## Get started

```bash
# Docker (recommended, zero configuration)
docker compose up                  # postgres + MinIO + store on :3000 (auto-migrates, seeds, creates admin)

# Local development
bun install                        # also runs generate:modules (--frozen) via postinstall
bun run generate:modules           # regenerate module imports from config
bun run db:seed                    # seed demo data (requires DATABASE_URL)
bun run dev                        # store dev server on :3000 (do NOT run in a headless cycle)
```

Default admin: `admin@86d.app` / `password123` (override with `APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD`).

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
bun run bump-version         # shared minor bump by default (see Version policy)
```

## Repository structure

```
apps/
  store/             Next.js storefront + per-store admin
  registry/          registry.json manifest generator and lock file
modules/             First-party Modules, one directory each (cart, products, orders, checkout, ...)
packages/
  core/              Module system: isolation boundary, contracts, types, sanitization, test-utils
  runtime/           Store runtime: ModuleRegistry, CompiledModuleDataService
  cli/               CLI tool (dev, init, module, template, generate, status, doctor)
  registry/          Git-based module registry (resolve, fetch, cache)
  storage/           Storage abstraction (local FS, Vercel Blob, S3-compatible)
  ui/                Shared merchant UI primitives, Console compositions, and data tables
  db/                Drizzle client singleton (lazy Pool; framework + core schema)
  auth/              Better Auth (sessions, admin role, 86d.app SSO)
  emails/            Email templates: React components sent via the Resend SDK
  env/               Zod env validation (includes STORAGE_CLIENT)
  utils/             Logger, rate-limit, url, sanitize (text + HTML)
  lib/               Webhook delivery, carrier tracking, notification settings, LLM content
  sdk/               Store config, workload identity token client, template loading, API client
templates/
  brisa/             Default store template (config.json, MDX pages, globals.css)
tests/e2e/           Playwright E2E (storefront, admin, checkout, dashboard, accessibility, performance, visual)
internals/
  github/            CI composite Actions
  docker/            Docker entrypoint + legacy init.sql
  docs/              generated component-api.md
  generators/        generate-modules, generate-component-docs, bump-version
packages/db/seed/    demo seed catalog, assets, and fetch tooling
Dockerfile           Multi-stage build (deps → build → runtime)
docker-compose.yml   One-command local deployment (postgres + MinIO + store)
```

Package presence, generated registry metadata, or an existing endpoint does not establish product maturity. Inspect each capability's evidence and follow the canonical [Module maturity](#module-maturity) rules instead of assigning status from the source tree.

## Module system

Every Module exports a factory with `id`, `version`, required `storage`, `endpoints`, and optional `init`. Every installable Module declares exactly one canonical storage branch: `{ kind: "none" }`, `{ kind: "config", config }`, or `{ kind: "relational", tables?, extends?, anchors?, publishes?, config? }`. Relational shapes are native Zod with the `col` registry. Modules depend **only** on `@86d-app/core` (one exception: `managed-payments` also depends on `@86d-app/sdk`). Database access goes through `ModuleDataService`, which binds each Module operation to the compiled query surface under `mod_<moduleId>` (and Config functions when declared). The Module contract is defined in [`../prd/contexts/store-runtime/module-system.md`](../prd/contexts/store-runtime/module-system.md).

**Storage authority:** Drizzle owns framework tables (auth, commands, outbox, files, logs, webhooks) and `core.*`. The schema compiler emits Module table DDL plus isolation identities (roles, Config `SECURITY DEFINER` functions, published views, grants, revocations, and statement timeouts). The login role holds no Module privileges; request transactions enter the Module role with `SET LOCAL ROLE`. Legacy `Module.schema` and `transcodeModuleSchema` are removed.

The target cross-Module boundary uses typed synchronous capability calls for immediate business decisions and a durable transactional outbox with versioned, idempotent events for completed changes. The current `requires` and `exports` contracts and in-memory event behavior are migration state where they do not meet that boundary.

Admin pages declare a `group` and optional `subgroup` for the 2-level sidebar. Groups: Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, System. Subgroup mapping is centralized in `apps/store/lib/admin-registry.ts`.

```
modules/<name>/src/
  index.ts              Factory + types + admin nav (no `export { … } from` barrels)
  schema.ts             Native `storage` declaration (Zod + col)
  service.ts            Business-logic interface
  service-impl.ts       Business-logic implementation
  store/endpoints/      Public endpoints
  store/components/     Customer-facing components (.tsx + .mdx)
  admin/endpoints/      Protected endpoints
  admin/components/     Admin UI components (.tsx + .mdx)
```

External-provider Modules include real HTTP integrations, but each provider path must be verified independently before it is called Stable. Missing credentials may hide an optional Integration. A required Checkout decision must instead fail closed or enter an explicitly non-binding review path. Never accept an unsigned webhook, shopper-supplied provider result, or silent provider fallback.

## Template system

Templates live in `templates/<name>/`. The store app resolves them via tsconfig alias `template/*` → `../../templates/brisa/*`. Each template has `config.json` (modules, OKLCH color tokens, logos), `layout.mdx`, `index.mdx`, page MDX files, and `globals.css`. Components follow a two-file pattern: `.tsx` (logic) + `.mdx` (presentation).

**Component overrides:** templates override Module components through `templates/<name>/components/mdx.tsx`. Exported names replace matching Module defaults at render time. `generate:modules` wires this up by spreading `...templateOverrides` last in `generated/components.ts`. **External templates:** `86d template add github:owner/repo`.

## CLI

`bun run 86d <command>` (source: `packages/cli/src/commands/`):

- `dev`, `init`, `status`, `doctor`
- `module build | create | add | list | search | info | enable | disable`
- `template create | activate | list`
- `generate modules | components`

Module packages use `"build": "86d module build"` (TypeScript → `dist/` plus non-TS asset copy). Add `"86d": "workspace:*"` (or a published CLI version) as a devDependency so the bin resolves. The workspace bin is `packages/cli/bin/86d.mjs` (a file that exists at install time); `dist/index.js` is gitignored and cannot be the workspace `bin` target.

## Registry

`apps/registry/registry.json` carries per-Module metadata: description, version, category, `requires`, `hasStoreComponents`, `hasAdminComponents`, `hasStorePages`, `maturity`, `maturityEvidence`, `commit`, `subtreeIntegrity`, and integrity hash. The resolver loads the manifest locally or from `https://raw.githubusercontent.com/86d-app/86d/main/apps/registry/registry.json`, which is the canonical source. Never assume a local copy is authoritative. The fetcher retries with exponential backoff (maximum 3 attempts, 500 to 2,000 milliseconds). A wildcard includes all registry Modules plus local workspace Modules.

`apps/registry/registry.lock.json` is the committed integrity snapshot for those resolutions. It is a **required work gate**: regenerate it with `bun run generate:modules` whenever Module source changes, commit it, then verify `bun run generate:modules -- --frozen`. See [Required gates](#required-gates-every-slice).

## Deployment modes

- **Docker (self-hosted):** `docker compose up` starts PostgreSQL, MinIO, and the store; auto-runs migrations, seeds demo data, creates the admin user, and stores blobs in MinIO (`STORAGE_CLIENT=s3`). Set `BETTER_AUTH_SECRET` to a secure random string in production.
- **Managed (Railway):** the Control Plane within 86d.app provisions a dedicated instance with its own database, hosting, and blob storage. Managed identity is `86D_STORE_ID`, `86D_API_URL`, and an opaque `86D_WORKLOAD_CREDENTIAL` exchanged for short-lived scoped tokens (`packages/sdk`); the runtime pulls managed configuration through that token client, and Store Admin SSO uses a dedicated OAuth client (`86D_ADMIN_OAUTH_CLIENT_ID` / `86D_ADMIN_OAUTH_CLIENT_SECRET`). Standalone `STORE_ID` remains for local data isolation.
- **Storage providers:** `STORAGE_CLIENT` = `local` (env default), `vercel`, or `s3` (MinIO, AWS S3, R2). See `.env.example`.

## API endpoints

- `GET /api/health`: database connectivity and Store status (Docker `HEALTHCHECK`).
- `POST /api/upload`: file upload (admin only; JPEG, PNG, WebP, GIF, SVG, and PDF; magic-byte validation; SVG XSS checks).
- `DELETE /api/upload`: file deletion (admin only, Store-isolated).
- `GET /uploads/[...path]`: serve local-storage files when `STORAGE_CLIENT=local` (SVGs use restrictive CSP).
- `GET/POST /api/auth/[...all]`: Better Auth handlers (sign-in, sign-up, SSO).
- `ALL /api/[...path]`: Module endpoints (rate-limited, session-authenticated).

## Terminology

- **86d.app** — the optional managed product; **86d Console** — its human-facing interface.
- **86d.store** / **Store Runtime** — the deployed open-source product; use these, not bare "store app", when the deployment boundary matters.
- **storefront** — the shopper experience; **store admin** — the merchant operating interface inside one Store Runtime.
- **Control Plane** — the architectural authority within 86d.app; use in code comments, plans, `prd/`, and documentation — never in merchant copy.
- **feature** and **integration** — merchant language; **module** — the technical packaging unit in this repository; **Connection** — a configured provider relationship used by an Integration.
- Sentence case in merchant copy: store, business, storefront, store admin, module, feature, and integration are ordinary nouns. When one starts a sentence, heading, or nav label, capitalize only the first word: **Store admin**, not **Store Admin**. Keep **Store Runtime**, **86d Console**, and code identifiers as written. (Published docs follow the Capitalization rules in `../docs/AGENTS.md` instead, which capitalize defined 86d concepts.)
- Name the owner instead of bare "dashboard" or "console": **86d Console** in product copy, `console` for its app, package, and code identifiers.

## Code conventions

- Biome handles formatting and linting in one repo-root pass (`bun run check`). Domains: `next` (all), `react` (recommended), `tailwind`, `turborepo`, `types`; test files also enable `test` and `playwright`. Tailwind class sorting is enforced via `useSortedClasses`.
- No `any`, `@ts-expect-error`, `@ts-ignore`, or `biome-ignore`. Fix the type or the code.
- Module `src/index.ts` must not use `export { … } from` (Biome `noBarrelFile`). Keep the factory and its own declarations in the entry; named package-root exports use import-then-export. Type-only `export type { … } from` is allowed. Consumers still import from `@86d-app/<module>` or the existing `"./*"` subpath map.
- `@86d-app/core` exposes subpath exports only — there is no package-root import. Module types come from `@86d-app/core/types/module`; target storage declarations use `col` and declaration types from `@86d-app/core/schema` plus `z` from `@86d-app/core/zod`. Other common paths are `@86d-app/core/sanitize`, `@86d-app/core/state` (MobX), `@86d-app/core/client/*` (React Query hooks, provider, client), and `@86d-app/core/test-utils`.
- Shared Command and Change Set wire contracts live in `@86d-app/contracts` (`./command`, `./change-set`, `./conformance`). `@86d-app/core/commands` re-exports only; do not add schemas there. Pin the exact package version and verify `CONFORMANCE_DIGEST` via `assertConformancePin` before serving Commands.
- Store app path alias: `~/` for local imports (not bare `lib/`, which conflicts with `packages/lib`).
- Use the `@86d-app/storage` abstraction. Never import `@vercel/blob` directly.
- Tests use `@86d-app/core/test-utils` mock data services. Never hit a real database.

## Security conventions

- **Sanitize all user text** in store endpoints: `.transform(sanitizeText)` from `@86d-app/core/sanitize` on every user-provided string (names, descriptions, messages, notes, titles).
- **Bound string lengths:** add `.max()` to every string field, even optional ones. **Bound arrays:** `.max()` on every user-input array.
- **Constrain records:** `z.record(z.string().max(100), z.unknown())` with `.refine()` to limit key count on arbitrary metadata.
- **Admin endpoints** are auth-protected at the framework level through `createAdminEndpoint`; no per-endpoint checks are needed.
- **Rate limiting** at the route handler (`apps/store/app/api/[...path]/route.ts`): 2,000 req/min per IP public, 300 req/min per user admin, 10 per 10 minutes on sensitive endpoints, 600 req/min per IP for provider webhooks.
- **Rich HTML** fields (page content, blog posts) use `sanitizeHtml()` instead of `sanitizeText()`, in the admin endpoint that accepts the field. Storing sanitized content keeps the render path free of a second pass.
- **Return errors, don't throw:** store endpoints `return { error: "...", status: 404 }` to avoid stack-trace leakage.
- **Never trust client identity:** derive `customerId`/email from `ctx.context.session.user`, never the request body. Never accept trust-elevation flags (e.g. `isVerifiedPurchase`) from clients.
- **Verify ownership** before mutating user-scoped resources (`resource.customerId === session.user.id`); return 404, not 403, to avoid leaking existence.

## Module maturity

Maturity enablement behavior is defined in [`../prd/launch.md`](../prd/launch.md#maturity-model). Registry generation records versioned maturity, `maturityEvidence`, commit SHA, and a hash of the complete Module subtree — machine-written fields, so inspect the evidence itself rather than inferring maturity from a field's presence.

## Testing

**Unit (Vitest):** `bun run test`, with `@86d-app/core/test-utils` mocks. External-provider fixtures must match the real API JSON shape so a broken integration cannot pass.

**E2E (Playwright):** config at `tests/playwright.config.ts`; specs `storefront`, `checkout`, `admin`, `dashboard`, `accessibility`, `performance`, `visual`. Visual regression runs across viewport projects `visual-desktop` (1280×720), `visual-tablet` (768×1024), `visual-mobile` (375×667), in light and dark. Import from `./fixtures/test-fixtures`, not `@playwright/test`. Selectors are always `data-testid`. Wait with web-first assertions; never `waitForTimeout()`. Older specs use `waitForLoadState('networkidle')`, which Biome's `noPlaywrightNetworkidle` ratchet now warns on — burn that backlog down, don't add to it. Coverage target: every page route, admin screen, store-facing screen, empty state, and error state.

## Health gates

Use the scripts in `package.json` (`check`, `typecheck`, `test`, `build`) and the repository `ci/cd` composite Action. `bun run check` is one repo-root Biome pass, so `internals/`, `tests/`, `templates/`, and root config files are covered, not just package `src/`. Playwright (`test:e2e`) needs an already running, seeded Store. Authenticated setup fails if the admin session cannot be created.

CI event and gate selection live in `.github/workflows/ci.yml` and `internals/github/ci-cd/action.yml`; read those files instead of copying the matrix into repository guides.

## Git safety

**Agents never push.** Local work stays local until the operator publishes it. This covers every publication path: `git push` and all its variants, `gh`, and any tool that uploads branches or rewrites remote history.

## Commits

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/) with a **required scope**: `type(scope): subject` — imperative, lowercase subject, no trailing period, under 72 characters when possible. Husky and commitlint enforce the format locally; CI enforces it on pull requests. See `CONTRIBUTING.md` for the full contributor guide.

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `store`, `cli`, `core`, `runtime`, `sdk`, `registry`, `db`, `emails`, `env`, `lib`, `storage`, `ui`, `utils`, `modules`, `ci`, `deps`, `config`, `docs`, `repo`. Scope is the directory you changed (`packages/core/` → `core`, `packages/ui/` → `ui`, `apps/store/` → `store`, `modules/*` → `modules`); non-obvious mappings: `apps/registry/` and `packages/registry/` → `registry`, `.github/workflows/` → `ci`, lockfiles and dependency bumps → `deps`, `biome.json`/`turbo.json`/tsconfig → `config`, cross-cutting repo or hook changes → `repo`.

**Agent rules:**

- Commit only when the user asks, or when finishing a self-contained slice that passes the PR health gates. Pre-commit runs Biome on staged files via lint-staged.
- One logical change per commit. Split unrelated work (for example a store UI fix and a module schema change) into separate commits.
- Let the hooks run: `git commit --no-verify` only when the user explicitly requests it.
- Run `bunx changeset` when a published package or module API changes, and commit the generated file in a separate `chore(repo): add changeset` commit when appropriate.

## Version policy

One shared version line covers the root `package.json`, the `86d` CLI, every publishable package and module, and every other workspace `package.json` that carries a version on that line (including private packages such as `db` and `auth`). `@86d-app/contracts` stays on that same line: its `package.json`, `CONTRACTS_PACKAGE_VERSION`, `generate:conformance` artifact version, and the private `vendor/` pin move together.

**Default bump is minor.** After the work that warrants a release is committed, run `bun run bump-version` (minor). Use patch or major only when the operator names that kind. The script updates the shared line, regenerates `apps/registry/registry.json` and `apps/registry/registry.lock.json`, and self-skips if it already bumped within 24 hours (`--force` to override). Commit the result as `chore(repo): bump version to X.Y.Z`, then regenerate contracts and refresh the private vendor pin when contracts changed.

A new package joins the current shared version on creation. Run `bun run bump-version` for every version change; do not hand-edit `version` fields or invent a second line for one package.

**Release CI** (`.github/workflows/release.yml`) publishes on push to `main` when no pending `.changeset/` files remain and package versions are ahead of npm. The release script builds packages/modules, runs `bun run prepare-publish` (rewrites `workspace:*` / `catalog:` to semver and swaps `exports` to `publishConfig.exports` under `dist/`), gates with `prepare-publish --check` + `verify-publish-packs`, then `changeset publish`, then restores package.json backups. Auth is npm trusted publishing (OIDC): the job uses the `npm-publish` GitHub Environment, `id-token: write`, and matching trusted-publisher entries (org, repo, workflow `release.yml`, environment `npm-publish`). Do not restore long-lived publish tokens. Packages should require 2FA and disallow token publish.

**Published tarball contract:** every publishable package ships compiled `dist/` (`.js` + `.d.ts`, plus copied non-TS assets such as `.mdx`). Workspace `exports` may still point at `./src` for local DX; npm consumers must resolve `./dist` only. Do not publish `src`, `__tests__`, `.turbo`, `vitest.config.ts`, `AGENTS.md`, or `tsconfig.json`. `@86d-app/contracts`, `@86d-app/registry`, `@86d-app/storage`, and `@86d-app/ui` stay on the shared version line and publish whenever that version is ahead of npm (including first publish of a new package name).

## Detailed docs

- `apps/store/AGENTS.md`: Store app architecture, routes, Store Admin, and theme system.
- `apps/store/EXAMPLES.md`: Module usage examples.
- `templates/brisa/AGENTS.md`: template authoring guide.
- `tests/e2e/AGENTS.md`: E2E patterns, fixtures, and conventions.
