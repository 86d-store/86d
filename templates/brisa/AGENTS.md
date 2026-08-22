# Brisa Template

Default store template: layout, pages, and theme via MDX and Module components.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Storefront/admin theme work also uses [`apps/store/AGENTS.md`](../../apps/store/AGENTS.md). Visual work loads workspace `prd/experience.md` per the parent.
2. **Implement** using the local patterns below. Merchant-reachable copy follows parent product language.
3. **Verify.** Focused store checks while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
templates/brisa/
  config.json                Theme config (name, modules, OKLCH colors, logos)
  layout.mdx                 Global layout (StoreNavbar, Cart, Footer)
  navbar.mdx                 Navbar presentation (logo, nav links, theme toggle, mobile menu)
  footer.mdx                 Footer presentation (newsletter, links, social)
  index.mdx                  Homepage (hero, marquee, featured products, collections, newsletter, blog, CTA)
  globals.css                Template-specific CSS overrides (optional, not auto-imported)
  about.mdx                  About page (story, values grid)
  contact.mdx                Contact form (name/email/subject/message, newsletter opt-in, success state)
  terms.mdx                  Terms of Service (legal sections, lastUpdated prop)
  privacy.mdx                Privacy Policy (legal sections, lastUpdated prop)
  track/index.mdx            Order tracking (wraps OrderTracker)
  search/index.mdx           Search page heading (wraps SearchPage)
  products/
    layout.mdx               Product listing (heading + ProductListing)
    [slug]/layout.mdx         Product detail (wraps ProductDetail with slug prop)
  collections/
    layout.mdx               Collection listing (heading + CollectionGrid)
    [slug]/layout.mdx         Collection detail (wraps CollectionDetail with slug prop)
  blog/
    layout.mdx               Blog listing (heading + BlogList)
    [slug]/layout.mdx         Blog post detail (wraps BlogPostDetail with slug prop)
  assets/
    favicon.svg              32x32 favicon (rounded rect + "86" text)
    logo/light.svg           Full logo for light theme
    logo/dark.svg            Full logo for dark theme
    icon/light.svg           Icon-only mark for light theme
    icon/dark.svg            Icon-only mark for dark theme
  llms.txt                   LLM-readable project description
```

## config.json

- `theme`: `"brisa"`
- `name`: store display name
- `modules`: `"*"` (wildcard) or array of module package names
- `moduleOptions`: per-module config (e.g. cart expiration)
- `variables.light` / `variables.dark`: OKLCH color tokens as CSS custom properties

## MDX props

- **layout.mdx**: `props.config`, `props.theme`, `props.children`
- **navbar.mdx**: `props.logo`, `props.storeName`, `props.navItems`, `props.actions`, `props.scrolled`, `props.isOpen`, `props.mounted`, `props.resolvedTheme`, `props.toggleTheme`, `props.toggleMenu`, `props.handleNavClick`
- **footer.mdx**: `props.logo`, `props.storeName`, `props.sections`
- **contact.mdx**: `props.submitted`, `props.submitting`, `props.handleSubmit`, `props.newsletter`, `props.setNewsletter`
- **terms/privacy.mdx**: `props.lastUpdated`
- **[slug]/layout.mdx**: `props.slug` (from URL params)

## Module components used

Components auto-register from enabled modules:

| Component | Source Module | Used In |
|-----------|-------------|---------|
| StoreNavbar | core | layout.mdx |
| Cart | cart | layout.mdx |
| CartButton | cart | layout.mdx |
| Footer | core | layout.mdx |
| FeaturedProducts | products | index.mdx |
| CollectionGrid | products | index.mdx, collections/ |
| CollectionDetail | products | collections/[slug]/ |
| ProductListing | products | products/ |
| ProductDetail | products | products/[slug]/ |
| NewsletterInline | newsletter | index.mdx |
| NewsletterForm | newsletter | footer.mdx |
| BlogList | blog | index.mdx, blog/ |
| BlogPostDetail | blog | blog/[slug]/ |
| OrderTracker | orders | track/ |
| SearchPage | search | search/ |
| StoreSearchCommand | search | navbar.mdx |
| Logo, LogoImage | core | footer.mdx |

## Patterns

- **Two-file pattern**: Module components use `.tsx` (logic) + `.mdx` (presentation). Template MDX imports Module components by name.
- **Detail pages**: wrapper with max-width + padding; pass `slug={props.slug}`
- **Listing pages**: heading + component; no slug
- **Static pages**: self-contained MDX with Tailwind; `max-w-3xl` container
- **Animations**: `animate-marquee` and `animate-fade-in` live in `apps/store/app/globals.css`
- **Font**: `font-display` uses `--font-display` (Zalando Sans in default setup)

## Gotchas

- Template `globals.css` is **not** auto-imported — reference only. Animations live in `apps/store/app/globals.css`
- `modules: "*"` enables all installed modules; use an array to restrict
- SVG assets use hardcoded colors (`#111` / `#f5f5f5`) instead of CSS variables (favicon, OG image may load outside theme context)
- `animate-marquee` requires duplicated content in the MDX for seamless looping
- `props.slug` on detail pages comes from URL params, not from the Module
