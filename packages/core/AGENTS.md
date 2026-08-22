# Core

Module system foundation: endpoints, typed capabilities, adapters, local controllers, and client hooks.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Module storage and runtime patterns also live in the parent Module and runtime section.
2. **Implement** using the local patterns below. Keep the isolation boundary intact.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_ and no Module gains a second data or platform path outside this package.

## Structure

```
src/
  index.ts          Main exports (adapters, routers, types)
  api.ts            Endpoint creation via better-call
  capabilities.ts   Typed capability definition/provider/invocation contracts
  commerce-capabilities.ts Pure versioned schemas shared by owners and consumers
  adapters.ts       Adapter pattern definitions
  client/
    index.ts        Auto-generated React hooks from module endpoints
  types/
    helper.ts       Utility types
    module.ts       Module interface, ModuleContext, ModuleDataService
    schema.ts       ModuleSchema type (Zod-based model definitions)
```

## Key exports

- `createRouter`, `createStoreEndpoint`, `createAdminEndpoint` — module HTTP endpoints
- `Module` — contract every module implements
- `ModuleContext` — runtime context at module init
- `ModuleDataService` — universal data access (get, findMany, upsert, delete)
- `defineCapability`, `provideCapability`, `acceptCapability` — versioned, runtime-validated synchronous Module decisions
- Client hooks auto-derive from endpoints: GET → query; POST/PUT/DELETE → mutation
- `sanitizeText(input)` — strip HTML tags and normalize whitespace (plain-text fields)
- `sanitizeHtml(input)` — rebuild rich text from an allow-list; apply where content is accepted, not where it is rendered
- `escapeScriptContent(input)` — escape `</` and `<!--` for safe embedding inside `<script>` (JSON-LD etc.)

Subpath imports only (`@86d-app/core/types/module`, `@86d-app/core/schema`, `@86d-app/core/zod`, `@86d-app/core/sanitize`, `@86d-app/core/state`, `@86d-app/core/client/*`, `@86d-app/core/test-utils`). No package-root barrel for Modules.

## Isolation boundary

This package is the sandbox Modules operate in. Modules depend **only** on `@86d-app/core`:
- `ModuleDataService` is the sole interface for a Module's own data — no direct DB client
- `ModuleContext` supplies runtime needs — no env vars, no platform package imports
- Modules may use `fetch()` for external HTTP
- Module components export as `MDXComponents` for the store registry

`packages/runtime` implements these interfaces against Drizzle and compiled Module tables; Modules never see that layer.

## Inter-module capabilities

Modules never receive another Module's data service, controller, or configuration. Immediate cross-Module decisions use a versioned capability declared by both sides:

```ts
const availability = defineCapability({
  name: "inventory.availability",
  version: "1.0.0",
  owner: "inventory",
  request: z.object({ sku: z.string() }),
  decision: z.object({ available: z.boolean() }),
  failure: z.object({ code: z.literal("not_found") }),
})

// Owner Module metadata
provides: [provideCapability(availability, handler)]

// Consumer Module metadata
accepts: [acceptCapability(availability)]
```

For discriminated multi-operation contracts, consumers pass the smallest `operations` allowlist to `acceptCapability`. The runtime resolves exactly one compatible owner before initialization effects, rejects operations outside that consumer grant, and validates request, decision, and failure at invocation. A provider runs only with its own `ModuleDataService`. Older `exports`/`requires` field declarations remain compatibility metadata during migration; they do not grant cross-Module data access.

Completed changes cross Module boundaries through versioned, idempotent durable events (parent Module patterns).

## Admin page declarations

```ts
admin: {
  pages: [
    { path: "/admin/products", component: "ProductList", label: "Products", icon: "Package", group: "Catalog" },
    { path: "/admin/products/:id/edit", component: "ProductEdit" },  // no label = not in sidebar
  ]
}
```

- `group` — Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, or System
- `subgroup` — optional second level (e.g. `"Orders"` under Sales). If omitted, `apps/store/lib/admin-registry.ts` assigns from the path segment after `/admin/`

## Local notes

- This is the only package Module authors depend on (`@86d-app/core`)
- Endpoints use `better-call` for type-safe definitions
- Unit tests mock data services via `@86d-app/core/test-utils`; never a real database
