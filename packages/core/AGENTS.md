# Core

Module system foundation for 86d. Defines how modules declare endpoints, typed capabilities, adapters, local controllers, and client hooks.

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

- `createRouter`, `createStoreEndpoint`, `createAdminEndpoint` — define module HTTP endpoints
- `Module` interface — the contract every module implements
- `ModuleContext` — runtime context passed to module init
- `ModuleDataService` — universal data access (get, findMany, upsert, delete)
- `defineCapability`, `provideCapability`, `acceptCapability` — versioned, runtime-validated synchronous Module decisions
- Client hooks auto-derive from endpoints: GET becomes query, POST/PUT/DELETE becomes mutation
- `sanitizeText(input)` — strip all HTML tags and normalize whitespace (for plain-text fields)
- `sanitizeHtml(input)` — rebuild rich text from an allow-list of tags and attributes, for content rendered via `dangerouslySetInnerHTML`. Apply it where content is accepted, not where it is rendered: the output is safe to store, and a second pass is wasted work
- `escapeScriptContent(input)` — escape `</` and `<!--` for safe embedding inside `<script>` tags (for JSON-LD etc.)

## Isolation boundary

This package defines the sandbox that modules operate within. Modules depend ONLY on `@86d-app/core`:
- `ModuleDataService` is the sole interface for a module's own data — no direct DB client
- `ModuleContext` provides everything a module needs at runtime — no env vars, no platform package imports
- Modules can use `fetch()` for external HTTP requests
- Module components export as `MDXComponents` for the store's component registry

The runtime (`packages/runtime`) implements these interfaces against Drizzle and compiled Module tables, but modules never see that layer.

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

For discriminated multi-operation contracts, consumers pass the smallest `operations` allowlist to `acceptCapability`. The runtime resolves exactly one compatible owner before initialization effects, rejects operations outside that consumer grant, and validates the request, decision, and failure at invocation. A provider is invoked only with its own `ModuleDataService`. The older `exports`/`requires` field declarations remain compatibility metadata during migration; they do not grant cross-Module data access.

## Admin page declarations

Modules declare admin pages with optional sidebar metadata:

```ts
admin: {
  pages: [
    { path: "/admin/products", component: "ProductList", label: "Products", icon: "Package", group: "Catalog" },
    { path: "/admin/products/:id/edit", component: "ProductEdit" },  // no label = not in sidebar
  ]
}
```

- `group` — sidebar section (Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, System)
- `subgroup` — optional 2nd-level grouping within a group (e.g., "Orders" within "Sales"). If omitted, assigned automatically by `admin-registry.ts` based on the path segment after `/admin/`

## Key details

- This is the only package module authors depend on (`@86d-app/core`)
- Uses `better-call` for type-safe endpoint definitions
- Client hooks auto-derive from endpoints: GET becomes query, POST/PUT/DELETE becomes mutation
