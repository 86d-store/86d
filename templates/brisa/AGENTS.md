# Brisa Template

Default store template for 86d. Defines layout, pages, and theme using MDX and module components.

## File Structure

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
- `name`: Store display name
- `modules`: `"*"` (wildcard) or array of module package names
- `moduleOptions`: Per-module config (e.g., cart expiration)
- `variables.light` / `variables.dark`: OKLCH color tokens applied as CSS custom properties

## MDX Props

All MDX files receive props from their rendering context:

- **layout.mdx**: `props.config` (store config), `props.theme` (next-themes), `props.children`
- **navbar.mdx**: `props.logo`, `props.storeName`, `props.navItems`, `props.actions`, `props.scrolled`, `props.isOpen`, `props.mounted`, `props.resolvedTheme`, `props.toggleTheme`, `props.toggleMenu`, `props.handleNavClick`
- **footer.mdx**: `props.logo`, `props.storeName`, `props.sections`
- **contact.mdx**: `props.submitted`, `props.submitting`, `props.handleSubmit`, `props.newsletter`, `props.setNewsletter`
- **terms/privacy.mdx**: `props.lastUpdated`
- **[slug]/layout.mdx**: `props.slug` (from URL params)

## Module Components Used

Components are auto-registered from enabled modules. Used in template:

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

- **Two-file pattern**: Module components use `.tsx` (logic) + `.mdx` (presentation). Template MDX imports module components by name.
- **Detail pages**: Wrapper div with max-width + padding, passes `slug={props.slug}` to component
- **Listing pages**: Heading section + component, no slug needed
- **Static pages**: Self-contained MDX with Tailwind classes, `max-w-3xl` container
- **Animations**: `animate-marquee` (infinite scroll) and `animate-fade-in` are defined in the store's `globals.css`
- **Font**: `font-display` class uses `--font-display` CSS variable (Zalando Sans in default setup)

## Gotchas

- Template `globals.css` is NOT auto-imported — it's a reference file. Animations live in `apps/store/app/globals.css`.
- `modules: "*"` in config.json enables all installed modules. Use an array to restrict.
- SVG assets use hardcoded colors (`#111`/`#f5f5f5`) instead of CSS variables since SVGs may be loaded outside the theme context (favicon, OG image).
- The `animate-marquee` class requires the content to be duplicated in the MDX for seamless looping.
- `props.slug` on detail pages comes from URL params, not from the module.
