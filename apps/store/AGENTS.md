# Store

Customer-facing storefront and per-store admin in one Next.js app.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Module usage examples: [`EXAMPLES.md`](./EXAMPLES.md). Visual or interaction work also loads workspace `prd/experience.md` per the parent.
2. **Implement** using the local patterns below. Merchant-reachable copy follows parent product language.
3. **Verify.** Focused checks while iterating: `bun run typecheck` and package tests from repo root as needed. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
app/
  layout.tsx           Root layout (TRPC, analytics, theme, AppLayout)
  page.tsx             Storefront homepage (renders MDX template)
  globals.css          Tailwind entry point
  api/
    [...path]/         Catch-all route serving module endpoints (store + admin)
    auth/[...all]/     better-auth handler (GET + POST)
  auth/
    layout.tsx         Auth layout (redirects to /admin if already authed)
    signin/page.tsx    Sign-in page using ui/auth/signin-form
  admin/               Store admin (auth-protected, server layout checks session)
    layout.tsx         Server: getSession() → redirect /auth/signin if unauthed; wraps AdminShell
    page.tsx           Dashboard: stat cards fetching /api/admin/products + /api/admin/categories
    products/
      page.tsx         Products table (search, status filter, pagination, delete)
      new/page.tsx     Create product (uses ProductForm component)
      [id]/page.tsx    Edit product (uses ProductForm with productId prop)
    categories/
      page.tsx         Categories with inline create/edit form
    carts/
      page.tsx         Cart listing from /api/admin/carts
  products/
    page.tsx           Storefront products listing (renders MDX template)
    [slug]/page.tsx    Product detail (renders MDX template with slug prop)
  checkout/            Multi-step checkout flow (info → shipping → payment → review)
  llms.txt/            LLM-readable store description
mdx-components.tsx     Component registry (merges ui + app + module components)
components/
  index.tsx            App component exports (Logo, Navbar, Footer)
  navbar/
    index.tsx          Navbar: uses useAppContext + useTheme for config/logo, CartButton
    1.mdx              Template variant 1 (render logic)
  footer/
    index.tsx          Footer: uses useAppContext + useTheme for config/logo
    1.mdx              Template variant 1 (render logic)
  logo/                Logo component variants
  admin/
    shell.tsx          AdminShell: 2-level collapsible sidebar (groups + subgroups) + mobile menu
    product-form.tsx   ProductForm: create/edit form, fetches categories, slug auto-gen
```

## Surfaces

**Storefront (public).** Customer pages. Modules contribute store endpoints (`/api/[module]/...`) and store components through the theme/template system.

**Store admin (`/admin/`).** Auth-protected management UI under `app/admin/`.
- Server layout: `getSession()` guard + `AdminShell` client sidebar
- Admin pages are client components via `useModuleClient()` to `/api/admin/...`
- Admin module components use TSX logic + MDX presentation
- API traffic shares catch-all `api/[...path]/route.ts` (no separate admin route)

**Admin sidebar (2-level).**
- Groups: Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, System
- Subgroups: larger groups nest (e.g. Sales → Orders, Cart, Billing, Scheduling, Promotions, Add-ons). All nine groups have subgroups — Content (Publishing, Knowledge, Site), Finance (Gateways, Configuration), Support (Helpdesk, Messaging), System (Monitoring, Tools)
- Subgroup assignment is centralized in `lib/admin-registry.ts` via `SUBGROUP_CONFIG` (first path segment after `/admin/`). Modules may override with `subgroup` on `AdminPage`
- Collapse state persists in localStorage (`86d-admin-sidebar-collapsed`); active items auto-expand parents

## Theme and templates

Every visual component uses two files: `.tsx` for logic (state, fetch, handlers, config) and `.mdx` for presentation (props only). Numbered MDX files (`1.mdx`, `2.mdx`, …) are design variants; swap the import to change theme without touching logic.

```tsx
import One from "./1.mdx";
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  return <One items={items} isOpen={isOpen} setIsOpen={setIsOpen} />;
}
```

`mdx-components.tsx` merges in override order: `ui` primitives → `appComponents` (Navbar, Footer, Logo) → `moduleComponents` (generated) → per-page overrides.

**Breeza** is the first theme: minimal, high contrast, single primary accent, typography-forward, mobile-first. No gradients, glow, or multi-color accents.

`templates/brisa/config.json` drives theme name, installed modules, module options, OKLCH light/dark tokens, and asset paths. `layout.mdx` wraps pages; `index.mdx` is the homepage. Template details: [`templates/brisa/AGENTS.md`](../../templates/brisa/AGENTS.md).

## API edge

Catch-all `api/[...path]/route.ts` owns centralized rate limits (do not recreate per endpoint):
- Public: 2,000 requests/minute/IP
- Sensitive public (subscribe, checkout session creation, payment intents): 10 requests/10 minutes/IP
- Admin: 300 requests/minute/session user
- Provider webhooks: 600 requests/minute/source IP (parent security section)
- Limited responses include `Retry-After` and `X-RateLimit-Reset`
- Errors use structured logging and `{ error: { code, message } }`

**Durable events.** Bounded worker entrypoint: `bun run worker:durable-events`. Production scheduling is an operator/deployment concern. Web traffic is neither the scheduler nor the retry mechanism; mutation routes do not drain the outbox.

**Managed commerce-availability.** Managed Store Runtimes enforce the v2 Store-scoped commerce-availability decision at the API edge. Unavailable, stale, malformed, or unreachable managed configuration blocks shopper mutations and the insecure storefront serves a same-domain unavailable view. Admin operations, signed provider webhooks, and shopper reads remain reachable. A standalone Runtime has no managed credential signal, never calls the Control Plane for this gate, and remains fully operable.

## Webhook verification

Payment provider modules (stripe, square, paypal, braintree) verify webhook signatures inline with the Web Crypto API (no external crypto dependency; publishable). Each webhook endpoint:
- Captures the webhook secret in a closure at init via a factory
- Uses `requireRequest: true` so `ctx.request` can read the raw body
- Verifies HMAC with timing-safe comparison
- Returns 401 on invalid or expired signatures; passthrough when no secret is configured

## File upload and storage

- `POST /api/upload` — admin-only. Accepts JPEG, PNG, WebP, GIF, SVG, PDF.
  - Magic-byte validation (blocks MIME spoofing)
  - SVG XSS checks (scripts, event handlers, javascript URIs)
  - Size limits: 4.5 MB images, 10 MB PDFs
  - Stored at `stores/{storeId}/{uuid}` via `@86d-app/storage`
  - When `STORAGE_PUBLIC_URL_MODE=proxy`, responses use same-origin `/uploads/{key}` URLs
- `DELETE /api/upload` — admin-only; store isolation blocks cross-store deletion
- `GET /uploads/[...path]` — local files or S3-backed proxy
  - Local: `STORAGE_LOCAL_DIR`; S3 proxy: fetch internal storage URL, re-serve same-origin
  - Path traversal protection, immutable cache headers
  - SVGs: restrictive CSP (`default-src 'none'; style-src 'unsafe-inline'`); PDFs as attachments

## Local notes

- MDX pages: `.md` or `.mdx` (next.config.ts)
- Modules such as `@86d-app/cart` and `@86d-app/products` are direct dependencies; endpoints go through `api/[...path]/`
- Turbopack raw-loader for `.txt` files
- Dev: `bun run dev:store` from monorepo root (never leave running in a headless agent cycle)
- Inside this app, use `~/` for local imports; bare `lib/` conflicts with `packages/lib`
