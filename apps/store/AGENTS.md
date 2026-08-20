# Store

Customer-facing storefront AND per-store admin. Next.js app with two surfaces: the public storefront (theme/template system) and a secure store admin where modules register management UI.

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

## Two surfaces

### Storefront (public)
Customer-facing pages. Modules contribute store endpoints (`/api/[module]/...`) and store components. Uses the theme/template system.

### Store admin (`/admin/`)
Auth-protected, per-store management interface. Built at `app/admin/`.
- Layout: server component with `getSession()` auth guard + `AdminShell` client sidebar
- All admin pages are client components using `useModuleClient()` hooks to `/api/admin/...` endpoints
- Admin module components use the TSX+MDX pattern internally (logic in TSX, presentation in MDX)
- API routes served through existing catch-all `api/[...path]/route.ts` (no separate admin route needed)

### Admin sidebar navigation (2-level)
The sidebar uses a 2-level collapsible navigation system:
- **Level 1 (Groups)**: Catalog, Sales, Customers, Fulfillment, Marketing, Content, Finance, Support, System
- **Level 2 (Subgroups)**: Larger groups have collapsible subgroups (e.g., Sales → Orders, Cart, Billing, Scheduling, Promotions, Add-ons)
- Subgroup assignment is centralized in `lib/admin-registry.ts` via `SUBGROUP_CONFIG` — maps first path segment after `/admin/` to a subgroup
- Modules can override subgroup via `subgroup` field on `AdminPage` declarations
- All 9 groups have subgroups: Content (Publishing, Knowledge, Site), Finance (Gateways, Configuration), Support (Helpdesk, Messaging), System (Monitoring, Tools)
- Both group and subgroup collapse state persists in localStorage (`86d-admin-sidebar-collapsed`)
- Active items auto-expand their parent group and subgroup

## Theme/template pattern

Every visual component follows the two-file pattern:

1. **`.tsx` file** — business logic: state management, data fetching, event handlers, configuration objects
2. **`.mdx` file** — render logic: pure presentation template that receives all data as props

The `.tsx` file imports the MDX template and passes state as props:
```tsx
import One from "./1.mdx";
export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  return <One items={items} isOpen={isOpen} setIsOpen={setIsOpen} />;
}
```

Numbered MDX files (1.mdx, 2.mdx, 3.mdx) are design variants for the same component. Switching themes means swapping which numbered template is imported — business logic stays identical.

## Component registry

`mdx-components.tsx` merges components from multiple sources (in override order):
1. `ui` — UI primitives (needs reimplementation — was in removed `packages/ui`)
2. `appComponents` — store-specific (Navbar, Footer, Logo variants)
3. `moduleComponents` — auto-generated from installed modules (Cart, ProductCard, ProductGrid, etc.)
4. Per-page custom overrides

## Theme: Breeza

The first theme. Design principles:
- Minimal and clean — no gradients, no glow effects, no multi-color accents
- High contrast — text and interactive elements immediately readable
- Single primary color — monochromatic palette with one accent hue for CTAs
- Typography-forward — generous whitespace, let content breathe
- Mobile-first, responsive, fast

## Template configuration

`templates/brisa/config.json` drives the store:
- Theme name and installed modules list
- Module options (cart expiration, page sizes, etc.)
- OKLCH color tokens for light and dark mode CSS custom properties
- Asset paths (favicon, logo light/dark variants)

`templates/brisa/layout.mdx` — global page wrapper (Navbar, main, Footer)
`templates/brisa/index.mdx` — homepage content

## API rate limiting

The catch-all route handler (`api/[...path]/route.ts`) enforces rate limits:
- Public endpoints: 2000 requests/min per IP
- Sensitive endpoints (subscribe, checkout session creation, payment intents): 10 requests/10 min per IP
- Admin endpoints: 300 requests/min per userId
- Returns `Retry-After` and `X-RateLimit-Reset` headers when limited
- Structured logging on errors; consistent `{ error: { code, message } }` response shape

Durable event delivery also has a bounded independent worker entrypoint:
`bun run worker:durable-events`. Production scheduling is an operator/deployment
responsibility; HTTP mutation drains remain a latency optimization, not the only
retry path.

Managed Store Runtimes enforce the v2 Store-scoped commerce-availability
decision at the API edge. Unavailable, stale, malformed, or unreachable managed
configuration blocks shopper mutations and the insecure Storefront serves a
same-domain unavailable view. Admin operations, signed provider webhooks, and
shopper reads remain reachable. A standalone Runtime has no managed credential
signal, never calls the Control Plane for this gate, and remains fully operable.

## Webhook verification

Payment provider modules (stripe, square, paypal, braintree) each implement webhook signature verification inline — no external crypto dependency. They use the Web Crypto API directly to stay publishable. Each module's webhook endpoint:
- Captures the webhook secret in a closure at init via a factory function
- Uses `requireRequest: true` in endpoint options to access `ctx.request` for raw body reading
- Verifies HMAC signatures with timing-safe comparison
- Returns 401 on invalid or expired signatures; passthrough when no secret configured

## File upload & storage

- `POST /api/upload` — Admin-only file upload. Accepts JPEG, PNG, WebP, GIF, SVG, PDF.
  - Magic-byte validation prevents MIME spoofing
  - SVG files are checked for XSS (scripts, event handlers, javascript URIs)
  - Size limits: 4.5 MB for images, 10 MB for PDFs
  - Files stored at `stores/{storeId}/{uuid}` via `@86d-app/storage` abstraction
  - When `STORAGE_PUBLIC_URL_MODE=proxy`, upload responses return same-origin `/uploads/{key}` URLs
- `DELETE /api/upload` — Admin-only file deletion with store isolation (cross-store deletion prevented)
- `GET /uploads/[...path]` — Serves local files or proxies S3-backed uploads
  - Local mode reads from `STORAGE_LOCAL_DIR`
  - S3 proxy mode fetches from the internal storage URL and re-serves it as a same-origin response
  - Path traversal protection, immutable cache headers
  - SVGs served with restrictive CSP (`default-src 'none'; style-src 'unsafe-inline'`)
  - PDFs served as attachments

## Key details

- MDX support enabled — pages can be `.md` or `.mdx` (configured in next.config.ts)
- Modules (`@86d-app/cart`, `@86d-app/products`) are direct dependencies
- Module endpoints served through catch-all API route at `api/[...path]/`
- Turbopack configured with raw-loader for `.txt` files
- Dev: `bun run dev:store` from monorepo root
