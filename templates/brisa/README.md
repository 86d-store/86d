<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/concepts/templates](https://86d.app/docs/concepts/templates)

# Brisa — 86d Store Template

The default store template for [86d](https://86d.app). A clean, minimal e-commerce theme built with MDX and Tailwind CSS.

## Features

- Responsive layout (mobile, tablet, desktop)
- Dark/light mode with OKLCH color tokens
- SEO-friendly pages with proper headings and meta
- Module component integration (cart, products, blog, search, newsletter, etc.)
- Editorial homepage with catalog discovery links, featured products, and collections
- Shared MDX containers and headings across catalog, search, and journal pages
- Responsive navigation using the shared Sheet primitive and one theme-control composition
- One newsletter signup in the shared footer
- Contact form with newsletter opt-in
- Legal pages (terms, privacy)
- Order tracking
- Blog listing and detail pages

## Quick Start

This template is the default when creating a new 86d store:

```bash
npx @86d-store/86d init
```

Or activate it manually:

```bash
npx @86d-store/86d template activate brisa
```

## Configuration

Edit `config.json` to customize:

| Key | Description | Default |
|-----|-------------|---------|
| `name` | Store display name | `"86d Starter Kit"` |
| `modules` | Enabled Modules as explicit package names | The curated packages listed in `config.json` |
| `advanced` | Versioned opt-in for selected Experimental Modules | Version `1`, enabled |
| `moduleOptions` | Per-module config | Cart: 7d expiry, 100 max items |
| `variables.light` | Light theme OKLCH tokens | Neutral palette |
| `variables.dark` | Dark theme OKLCH tokens | Neutral dark palette |
| `favicon` | Path to favicon SVG | `/assets/favicon.svg` |
| `logo.light` / `logo.dark` | Logo paths per theme | `/assets/logo/` |
| `icon.light` / `icon.dark` | Icon paths per theme | `/assets/icon/` |

Brisa names each bundled Module instead of using wildcard discovery. Registry entries without maturity evidence are Experimental, so the template also records the versioned advanced opt-in. Remove packages you don't want before regenerating the Store imports.

## Pages

| Route | Template File | Description |
|-------|---------------|-------------|
| `/` | `index.mdx` | Homepage (hero, discovery links, commerce sections, journal) |
| `/products` | `products/layout.mdx` | Product catalog with filters |
| `/products/:slug` | `products/[slug]/layout.mdx` | Product detail |
| `/collections` | `collections/layout.mdx` | Collection grid |
| `/collections/:slug` | `collections/[slug]/layout.mdx` | Collection detail |
| `/blog` | `blog/layout.mdx` | Blog listing |
| `/blog/:slug` | `blog/[slug]/layout.mdx` | Blog post detail |
| `/search` | `search/index.mdx` | Product search |
| `/track` | `track/index.mdx` | Order tracking |
| `/about` | `about.mdx` | About the store |
| `/contact` | `contact.mdx` | Contact form |
| `/terms` | `terms.mdx` | Terms of Service |
| `/privacy` | `privacy.mdx` | Privacy Policy |
| `/gift-cards` | *(store app)* | Gift card balance check |

## Customizing

### Colors

All colors use OKLCH format in `config.json`. The key tokens:

- `background` / `foreground` — page background and text
- `primary` / `primary-foreground` — buttons, links
- `muted` / `muted-foreground` — secondary surfaces and text
- `border` — borders and dividers
- `destructive` — error states

### Navigation

Edit `layout.mdx` to change nav items:

```mdx
<StoreNavbar
  navItems={[
    { label: "Shop", href: "/products" },
    { label: "Collections", href: "/collections" },
    { label: "Blog", href: "/blog" },
  ]}
/>
```

### Footer sections

Edit the `sections` array passed to `StoreFooter` in `layout.mdx` to change footer links. Shop, Company, Help, and Legal use the same link-group presentation. The footer contains the storefront's shared newsletter signup; the homepage does not add a second form.

`StoreFooter` in `_components/footer.tsx` accepts `logo`, `storeName`, and `sections`, derives the copyright year, and passes those values to `footer.mdx`. Logo configuration has `url`, `lightSrc`, `darkSrc`, `alt`, and `title`; each section has a `title` and `links` with `name` and `href`.

### Assets

Replace the SVG files in `assets/` with your own logo and favicon. Maintain the same viewBox dimensions for proper sizing.

## Architecture

Templates are resolved via the `template/*` tsconfig alias. The store app imports template MDX files as React components. Module components (e.g., `<ProductListing />`, `<BlogList />`) are auto-registered when their modules are enabled.

Keep state, derived values, and event handlers in TypeScript; keep layout and render conditions in MDX. Presentation-only compositions do not need a TypeScript wrapper.

| File | Responsibility |
| --- | --- |
| `layout.mdx` | Store shell, navigation/footer configuration, cart and announcement composition |
| `navbar.mdx` | Desktop navigation and mobile Sheet presentation |
| `footer.mdx` | Newsletter, configured link groups, store identity and copyright presentation |
| `_components/container.mdx` | Shared responsive page width and horizontal padding |
| `_components/page-heading.mdx` | Page title, optional eyebrow and description, and optional children |
| `_components/quick-link.mdx` | Numbered discovery link with title, description, and destination |
| `_components/theme-control.mdx` | Light/dark actions with callbacks supplied by the navbar controller |
| `_components/footer.tsx` | Footer props contract and copyright year derivation |

The app's `StoreNavbar` controller owns open state, active-path matching, and theme handlers. Its `navbar.mdx` props are `logoLight`, `logoDark`, `storeName`, `navItems` (including derived `active`), `actions`, `isOpen`, `onOpenChange`, `handleNavClick`, `handleLightTheme`, and `handleDarkTheme`. The mobile Sheet closes after navigation and when the viewport reaches the desktop navigation breakpoint (1024px). The shared Sheet primitive owns focus containment, Escape handling, and scroll locking.

`StoreAction` and `StoreLink` are registered app compositions over the shared button primitive and its variants. `StoreLink` preserves anchor semantics; `StoreAction` accepts `static` for frequent controls that should skip press scaling. Keep shadcn primitive internals unchanged when customizing the template.

The homepage places optional commerce sections inside one container and leaves loading, empty, error, and data behavior with their owning modules. Hidden sections no longer leave padded outer wrappers. There is no animated trust marquee: only add shipping, return, or product claims after configuring and verifying the merchant's actual policy.

See [AGENTS.md](./AGENTS.md) for the full technical reference.
