# Brisa Template

Default store template: layout, pages, and theme via MDX and Module components.

**Scope:** This guide owns template-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and installed Module and UI contracts.

## Change protocol

1. **Route.** Read this guide and [`README.md`](./README.md). In the 86d.store source checkout, also read the [Store guide](../../apps/store/AGENTS.md), root [UI and composition](../../AGENTS.md#ui-and-composition), and [Product language](../../AGENTS.md#product-language).
2. **Implement** using the local patterns below and the current project's UI and copy rules.
3. **Verify.** Run the current project's Store and template checks. Source-checkout work also follows the root pre-commit gates, including the frozen registry check after Module changes.
   - Done when the current project's required checks pass.

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
