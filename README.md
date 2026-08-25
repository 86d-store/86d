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

📚 **Documentation:** [86d.app/docs](https://86d.app/docs)

## Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/86d?referralCode=zU4Wyt&utm_medium=integration&utm_source=template&utm_campaign=generic)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F86d-app%2F86d)

## Prerequisites

- [Bun](https://bun.sh) v1.4.0+
- [Node.js](https://nodejs.org) 23, 24, or 25
- [PostgreSQL](https://www.postgresql.org) v15+
- [Docker](https://docs.docker.com/get-docker/) with Buildx, plus Compose support for ephemeral published ports and `up --wait` / `--wait-timeout`

## Quick Start

```bash
bun install
bun run 86d init
bun run dev
```

The store will be available at [http://localhost:3000](http://localhost:3000).

## Docker Compose

```bash
docker compose up
```

This starts PostgreSQL, a MinIO S3-compatible bucket, and the store app.

- Store: [http://localhost:3000](http://localhost:3000)
- MinIO API: [http://localhost:9000](http://localhost:9000)
- MinIO Console: [http://localhost:9001](http://localhost:9001)
- Upload bucket: `86d-uploads`

In Docker, uploads are stored in MinIO and returned as same-origin `/uploads/...` URLs, so the browser never needs the raw bucket URL.

Build and smoke-test the production 86d.store Store Runtime image from your local workspace:

```bash
bun run docker:build
bun run docker:verify
```

After an operator completes a release, pull its immutable version tag from either registry:

```bash
docker pull ghcr.io/86d-app/store:VERSION
# or
docker pull docker.io/86dapp/store:VERSION
```

Replace `VERSION` with the exact release version, then start that image with the repository's Compose services:

```bash
STORE_IMAGE=ghcr.io/86d-app/store:VERSION docker compose up -d --no-build
# or
STORE_IMAGE=docker.io/86dapp/store:VERSION docker compose up -d --no-build
```

`latest` is promoted only after both registries expose the same immutable multi-platform image, but production deployments should stay pinned to a version or digest.

## Repository Structure

```
apps/store/          Next.js storefront + admin
modules/             First-party commerce Module packages
packages/
  core/              Module system foundation
  runtime/           Store runtime engine
  cli/               CLI tool
templates/
  brisa/             Default store template
internals/           Repo tooling (generators, registry, CI actions)
packages/db/         Drizzle client + demo seed
```

## CLI

```bash
bun run 86d dev                    # Start dev server
bun run 86d init                   # Configure local store
bun run 86d module create <name>   # Scaffold a new module
bun run 86d module list            # List all modules
bun run 86d template create <name> # Create a new template from brisa
bun run 86d template list          # List all templates
bun run 86d generate               # Run code generation
```

## Scripts

```bash
bun run dev              # Dev server for the store
bun run build            # Build publishable workspace artifacts
bun run docker:build     # Build the production Store Runtime image
bun run docker:verify    # Smoke-test the image with Compose
bun run typecheck        # TypeScript check
bun run check            # Biome lint/format
bun run test             # Unit tests
bun run test:e2e         # Playwright E2E tests
```

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable               | Description                          |
|------------------------|--------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string         |
| `DATABASE_URL_UNPOOLED`| Same (used for migrations)           |
| `BETTER_AUTH_SECRET`   | Auth signing key (random string)     |
| `STORE_ID`             | Store identifier                     |
| `STORAGE_PUBLIC_URL_MODE` | Upload URL mode: `direct` or `proxy` |

## Creating a Module

```bash
bun run 86d module create my-feature
```

This scaffolds `modules/my-feature/` with the full module structure: entry point, schema, store/admin endpoints, and component stubs. Add `"@86d-app/my-feature"` to `templates/brisa/config.json` and run `bun run 86d generate`.

## Creating a Template

```bash
bun run 86d template create minimal
```

This copies the brisa template to `templates/minimal/` with updated config. Customize the MDX files, colors, and layout to create a new design.

## License

86d.store is licensed under the [MIT License](./LICENSE). 86d.app and the Control Plane remain proprietary.

## Known Issues

The store app has import references to packages that were part of the original proprietary codebase and have been removed. See [AGENTS.md](AGENTS.md) for the full list of packages that need reimplementation.
