# Brisa — 86d Store Template

The default store template for [86d](https://86d.app). A clean, minimal e-commerce theme built with MDX and Tailwind CSS.

## Features

- Responsive layout (mobile, tablet, desktop)
- Dark/light mode with OKLCH color tokens
- SEO-friendly pages with proper headings and meta
- Module component integration (cart, products, blog, search, newsletter, etc.)
- Marquee trust bar, featured products, collection grid
- Contact form with newsletter opt-in
- Legal pages (terms, privacy)
- Order tracking
- Blog listing and detail pages

## Quick Start

This template is the default when creating a new 86d store:

```bash
npx @86d-app/86d init
```

Or activate it manually:

```bash
npx @86d-app/86d template activate brisa
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
| `/` | `index.mdx` | Homepage (hero, products, collections, newsletter, blog) |
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

### Footer Sections

Edit the `sections` array in `layout.mdx` to change footer links.

### Assets

Replace the SVG files in `assets/` with your own logo and favicon. Maintain the same viewBox dimensions for proper sizing.

## Architecture

Templates are resolved via the `template/*` tsconfig alias. The store app imports template MDX files as React components. Module components (e.g., `<ProductListing />`, `<BlogList />`) are auto-registered when their modules are enabled.

See [AGENTS.md](./AGENTS.md) for the full technical reference.
