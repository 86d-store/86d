# 86d.store Store Runtime (public)

`public/` is the MIT-licensed 86d.store Store Runtime: one storefront, store admin, and authoritative commerce database per single-tenant Store. It runs standalone through Docker. The optional Control Plane in sibling `private/` may provision and operate it; standalone operation never acquires a Control Plane dependency.

This is a strict TypeScript Bun monorepo orchestrated by Turborepo.

## Change protocol

1. **Route the context.** Read workspace `../AGENTS.md` when it exists, then this guide, then every nearer `AGENTS.md` down to the files you will touch.
   - Product behavior, authority, payments, Checkout, Fulfillment, managed credentials, Modules, and agent surfaces: start at `../prd/README.md` and follow every reading route it names for the branch.
   - Visual or interaction work: also read `../prd/experience.md`, especially [Composition](../prd/experience.md#composition), before implementation. It owns UI/UX law; this guide owns repository mechanics.
   - Maturity or shipment claims: also read `../prd/current-state.md`, `../prd/launch.md`, and the relevant evidence. Code, endpoints, packages, and generated metadata do not prove maturity.
   - The PRD is target authority; code is current implementation. Resolve a difference through an explicit migration — never by silently treating either as the other.
   - Done when every named route for this branch is loaded and the authority boundary below is clear.
2. **Protect the authority boundary.** The Store Runtime owns commerce facts. The Control Plane owns only managed-service facts. Humans and agents use the same versioned Command contracts; raw transport is private implementation detail.
   - Done when the change cannot invent a second ownership of managed-service facts or a Control Plane dependency for standalone operation.
3. **Implement a complete _slice_.** Include its public interface, required durable persistence, closed failure behavior, focused tests, nearest documentation projection, and explicit evidence update when the canonical context requires one.
   - Done when every required artifact for the slice exists or is explicitly out of scope with a written reason.
4. **Verify the _slice_.** Apply the [Module integrity gate](#module-integrity-gate), run focused tests while iterating, then run every required pre-commit gate under [Git and commits](#git-and-commits).
   - Done when every required gate is _green_ (exit 0, no warnings, no errors).
5. **Keep publication _local_.** Agents never publish. The operator owns remotes and releases.
   - Done when no push, `gh`, PR tooling, or remote-history rewrite has been used.

Use `package.json` and `--help` as the command inventory. Never leave `bun run dev` or a Docker dev process running in a headless agent cycle.

## Module integrity gate

This gate applies to **every _slice_**, not only CI. GitHub Setup, Release, and e2e run `bun install`; `postinstall` runs `bun run generate:modules -- --frozen`. A stale `apps/registry/registry.lock.json` therefore fails every workflow during Setup.

- The lock hashes each Module's complete source subtree, including tests, fixtures, and `package.json`.
- After any change under `modules/`, run `bun run generate:modules` and commit the updated `apps/registry/registry.lock.json` in the same slice.
- Before declaring any slice complete, prove `bun run generate:modules -- --frozen` is _green_ under [Git and commits](#git-and-commits). Unit tests and typecheck do not substitute for this gate.
- Lint-staged regenerates the lock only for `modules/**/*.{ts,tsx,json,md,mdx}`. Regenerate it yourself for Module changes outside that glob; let hooks run.
- `bun run bump-version` regenerates both `apps/registry/registry.json` and the lock. Commit both outputs.

## Context routes

- Store routes, storefront, store admin, and theme work: `apps/store/AGENTS.md`; Module usage examples: `apps/store/EXAMPLES.md`.
- Module work: `../prd/contexts/store-runtime/module-system.md`, the target Module's `AGENTS.md`, and the closest package guides for any shared runtime code.
- Template work: `templates/brisa/AGENTS.md` or the target template's nearest guide.
- CLI work: `packages/cli/AGENTS.md`.
- Registry or lock work: `packages/registry/AGENTS.md`.
- E2E work: `tests/e2e/AGENTS.md`, with the stricter waiting rules in [Testing](#testing) taking precedence over stale examples there.

## Module and runtime patterns

Every installable Module exports a factory with `id`, `version`, required `storage`, `endpoints`, and optional `init`. It declares exactly one storage branch:

```ts
{ kind: "none" }
{ kind: "config", config }
{ kind: "relational", tables?, extends?, anchors?, publishes?, config? }
```

Relational declarations use native Zod plus the `col` registry. `@86d-app/core` is every Module's base internal dependency; current cross-plane contracts use `@86d-app/contracts`, server configuration uses `env`, and `managed-payments` also uses `@86d-app/sdk`. Treat any other internal dependency as an architecture change. Database work goes through `ModuleDataService`, bound to the compiled query surface under `mod_<moduleId>` and declared Config functions.

Drizzle owns framework tables for auth, commands, outbox, files, logs, and webhooks plus `core.*`. The schema compiler owns Module DDL, roles, Config `SECURITY DEFINER` functions, published views, grants, revocations, and statement timeouts. The login role has no Module privileges; request transactions enter the Module role with `SET LOCAL ROLE`. `Module.schema` and `transcodeModuleSchema` are removed patterns.

Use typed synchronous capabilities for immediate cross-Module decisions. Completed changes cross Module boundaries through versioned, idempotent durable events in the transactional outbox. Existing `requires`, `exports`, or in-memory events are migration state when they do not satisfy that contract.

Keep a Module's source shape recognizable:

```text
modules/<name>/src/
  index.ts              factory, local declarations, admin nav
  schema.ts             native storage declaration
  service.ts            business-logic interface
  service-impl.ts       implementation
  store/endpoints/      public endpoints
  store/components/     customer components (.tsx + .mdx)
  admin/endpoints/      protected endpoints
  admin/components/     admin components (.tsx + .mdx)
```

Admin pages declare a `group` and optional `subgroup`. Valid groups are Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, and System; subgroup mapping stays centralized in `apps/store/lib/admin-registry.ts`.

External-provider paths earn maturity independently. An optional Integration may hide when credentials are absent. A required Checkout decision fails closed or enters an explicitly non-binding review path. Accept only verified webhooks and server-derived provider outcomes; shopper input never supplies trust, money, tax, Shipping, inventory, or authorization results. No provider fallback is silent.

Templates use `.tsx` for logic and `.mdx` for presentation. Overrides live in `templates/<name>/components/mdx.tsx`; generated component registration spreads `...templateOverrides` last. CLI Module builds compile TypeScript and copy non-TS assets. The workspace CLI bin must exist at install time (`packages/cli/bin/86d.mjs`); a gitignored build output cannot be its workspace bin target.

The canonical registry manifest is the published `apps/registry/registry.json` from `86d-app/86d`, not an arbitrary local copy. Resolution checks local workspace Modules before the registry and verifies fetched integrity. Inspect `packages/registry/AGENTS.md` before changing this behavior.

## Deployment identity

- Production self-hosting uses a strong random `BETTER_AUTH_SECRET`. Storage is selected through `STORAGE_CLIENT`; keep its current values and required configuration in `.env.example` rather than duplicating provider setup in code.
- A managed runtime identifies itself with `86D_STORE_ID`, `86D_API_URL`, and an opaque `86D_WORKLOAD_CREDENTIAL` exchanged by `packages/sdk` for short-lived, Store-scoped tokens. Store admin SSO uses its dedicated OAuth client variables. Managed provider secrets never enter browser or merchant-readable configuration.
- Standalone `STORE_ID` remains available for local isolation and cannot require the managed identity exchange.

## TypeScript and imports

- Biome owns formatting and linting through one repository-root `bun run check`; fix findings rather than suppressing them. Auto-fix formatting on a narrow path; never change a diagnostic to hide an error.
- `any`, `@ts-expect-error`, `@ts-ignore`, and `biome-ignore` are prohibited. Fix types at boundaries — parameters, exports, and empty containers — then let inference carry downstream. Narrow a plain `as X` with guards or fix its source type.
- Ask before changing Biome, TypeScript, package, Tailwind, or Next configuration merely to silence a diagnostic. Tests are typechecked.
- Module `src/index.ts` is not a barrel: keep the factory and its declarations there. Named package-root exports use import-then-export. Type-only `export type { ... } from` is allowed. Direct subpath imports only; no barrels or `export *` except framework-mandated entrypoints.
- `@86d-app/core` has subpath exports only. Use `@86d-app/core/types/module`, `@86d-app/core/schema`, `@86d-app/core/zod`, `@86d-app/core/sanitize`, `@86d-app/core/state`, `@86d-app/core/client/*`, and `@86d-app/core/test-utils` as appropriate.
- Command and Change Set wire contracts live in `@86d-app/contracts` (`./command`, `./change-set`, `./conformance`). `@86d-app/core/commands` only re-exports them. Pin the exact contract version and call `assertConformancePin` before serving Commands.
- Inside `apps/store`, use `~/` for local imports. Bare `lib/` conflicts with `packages/lib`.
- Reach storage through `@86d-app/storage`; do not import `@vercel/blob` directly.
- Unit tests use `@86d-app/core/test-utils` data-service mocks and never a real database.
- Default to no comments. Add a one-line why comment only for a workaround, subtle invariant, or deliberate choice that otherwise looks wrong.
- While editing a file, fix convention violations in the same function, component, or file. Expand to co-located callers only when a signature change forces it.
- Use locale-aware `Intl.DateTimeFormat` and `Intl.NumberFormat`; check stored identifiers with `== null`, not falsiness. Handle every error path and prefer idempotent mutations.

## Request and security boundaries

- Apply `.transform(sanitizeText)` from `@86d-app/core/sanitize` to every user-provided text string in Store endpoints. Use `sanitizeHtml()` at the accepting admin endpoint for rich HTML.
- Bound every input string with `.max()`, including optional strings, and every input array with `.max()`.
- Bound arbitrary metadata records with `z.record(z.string().max(100), z.unknown())` plus a key-count `.refine()`.
- Create admin endpoints with `createAdminEndpoint`; framework authentication owns the guard.
- Keep centralized rate limits in `apps/store/app/api/[...path]/route.ts`: public 2,000 requests/minute/IP, admin 300/minute/session user, sensitive public 10/10 minutes/IP, and provider webhooks 600/minute/source IP. Do not recreate them per endpoint.
- Return endpoint errors as data, for example `return { error: "...", status: 404 }`, so stacks do not leak.
- Derive `customerId`, email, and other identity from `ctx.context.session.user`, never request input. Reject client-supplied trust-elevation flags.
- Verify ownership before mutating user-scoped resources. Return 404 rather than 403 when revealing existence would leak data.
- Money, Shipping, tax, webhook, and destructive paths execute only through a complete Workflow with evidence; otherwise they fail closed.

## UI and composition

Visual and interaction law lives in [`experience.md#composition`](../prd/experience.md#composition).

- Preserve existing UI composed from `@86d-app/ui`, Module `admin/components/` and `store/components/`, route `_components/`, or template `.tsx` + `.mdx` pairs. Wire data, loading, and error states through what exists.
- The only replacement agents should make is substituting ad hoc `div`/`span`/`p` or heavily classNamed layout/text for the matching `@86d-app/ui` primitive or Module component when one exists.
- Do not replace one composed surface with another unless `experience.md` and the active plan explicitly require it.

## Product language

Before editing merchant-reachable UI, email, support, pricing, errors, or agent prose, read `../prd/product.md#the-merchant-sees-86d-never-our-suppliers` and `../prd/experience.md#copy` in the full workspace.

- `86d.app` is the optional managed product; `86d Console` is its human interface.
- `86d.store` or `Store Runtime` names this deployed product. `storefront` is the shopper surface; `store admin` is the merchant interface inside one runtime.
- `Control Plane` names an architectural authority and stays out of merchant copy.
- `feature` and `integration` are merchant terms; `module` is the repository package; a `Connection` is a configured provider relationship used by an Integration.
- Merchant and published copy uses sentence-case common nouns: store, business, storefront, store admin, module, feature, integration. Keep product names such as 86d Console and Store Runtime.
- Name the owner: use `86d Console` in product copy and `console` only for its app/package identifiers.
- Supplier invisibility is absolute for 86d-managed capabilities. Merchant-reachable strings and UI identifiers use 86d product language. Vendor names stay in adapters, required environment keys, vendor-boundary tests, operator/PRD evidence, merchant-chosen Connections or hosts, and legally required disclosures.
- State current availability or omit the claim. Merchant copy does not use readiness hedges such as “at launch,” “coming soon,” or “WIP”; the Launch plan name remains valid.

## Testing

- Unit tests use Vitest. External-provider fixtures match the provider's real JSON shape so a broken adapter cannot pass against an invented fixture.
- Playwright needs an already running, seeded Store; authenticated setup fails when it cannot create the admin session. Import from `./fixtures/test-fixtures`, use `data-testid` selectors, and wait with web-first assertions.
- New tests never use `waitForTimeout()` or `waitForLoadState("networkidle")`. The `networkidle` pattern in a nearer guide is stale and does not override this rule.
- Cover every page route, admin and storefront screen, empty state, and error state. Visual coverage runs in light and dark at desktop (1280×720), tablet (768×1024), and mobile (375×667); `tests/playwright.config.ts` remains the executable source of truth. Read `../prd/experience.md` for the cross-product visual contract.

## Git and commits

Agents keep all work _local_. Do not use `git push`, `gh`, PR tooling, branch-upload tools, or any command that publishes or rewrites remote history.

Commits use Conventional Commits with a required scope: `type(scope): subject`. Use an imperative lowercase subject, no trailing period, and preferably fewer than 72 characters.

`CONTRIBUTING.md` is the contributor reference, but this guide's frozen-lock requirement and gate order are stricter and take precedence for agents.

Before changing CI triggers or gate selection, read `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`, `.github/workflows/release.yml`, and `internals/github/ci-cd/action.yml`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scopes: `store`, `cli`, `core`, `runtime`, `sdk`, `registry`, `db`, `emails`, `env`, `lib`, `storage`, `ui`, `utils`, `modules`, `ci`, `deps`, `config`, `docs`, `repo`.
- Scope follows the changed area. Notable mappings: either registry package/app → `registry`; `.github/workflows/` → `ci`; lockfiles and dependency bumps → `deps`; Biome, Turbo, or tsconfig changes → `config`; cross-cutting hooks/repository work → `repo`.

Commit guardrails:

1. Commit only when the user asks or when a self-contained slice is finished and every gate below is _green_.
2. Immediately before **every** commit, run this exact sequence from the repository root. A gate is _green_ only when the command exits 0 and its output contains no warnings and no errors:

   ```bash
   bun run generate:modules -- --frozen
   bun run typecheck
   bun run check
   bun run test
   bun run build
   ```

   The frozen registry check and typecheck come first. A green lint pass cannot waive any later failure.
3. Keep one logical change per commit. Split unrelated Store UI, Module, and package changes.
4. Let Husky and lint-staged run; pre-commit applies Biome to staged files and runs repository typecheck. Never use `git commit --no-verify`. If a hook fails, fix the cause and commit again.
5. When a published package or Module API changes, run `bunx changeset` and place the generated file in its own `chore(repo): add changeset` commit when appropriate.

## Version and release guardrails

One shared version line covers the root, CLI, publishable packages and Modules, versioned private workspace packages, and `@86d-app/contracts`. Contract `package.json`, `CONTRACTS_PACKAGE_VERSION`, conformance artifact version, and the private `vendor/` pin move together.

- After release-worthy work is committed, use `bun run bump-version`; minor is the default. Use patch or major only when the operator names it. The script self-skips when it bumped within 24 hours unless `--force` is passed. Never hand-edit a `version` field.
- The bump updates every package on the shared line plus `apps/registry/registry.json` and `apps/registry/registry.lock.json`. Commit it as `chore(repo): bump version to X.Y.Z`. Refresh generated contracts and the private vendor pin when contracts changed.
- A new package joins the current shared version when created.
- Before changing release mechanics, read `.github/workflows/release.yml`, `internals/github/ci-cd/action.yml`, and the publish scripts instead of copying their matrix here. Release follows successful CI on `main`; e2e is separate. Publish only with no pending Changesets and versions ahead of npm.
- Preserve npm trusted publishing through OIDC, package 2FA, and disabled token publishing. Never restore a long-lived publish token.
- `@86d-app/contracts`, `@86d-app/registry`, `@86d-app/storage`, and `@86d-app/ui` remain publishable on the shared version line and publish whenever that version is ahead of npm, including a first publish.
- Published packages resolve to compiled `dist/` JavaScript, declarations, and required non-TS assets. Tarballs exclude `src`, `__tests__`, `.turbo`, `vitest.config.ts`, `AGENTS.md`, and `tsconfig.json`. `prepare-publish --check` and `verify-publish-packs` are release gates.
