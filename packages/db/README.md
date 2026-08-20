<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# DB

Database package for the 86d platform. Provides a singleton Prisma client configured with the PrismaPg adapter for PostgreSQL.

## Installation

```sh
npm install db
```

## Usage

```ts
import { db } from "db";

const users = await db.user.findMany();
```

### Access Prisma utilities

```ts
import { Prisma } from "db";

type UserCreateInput = Prisma.UserCreateInput;
```

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (runtime) | PostgreSQL connection string |

The client is **lazy-initialized** — it is only created when first accessed at runtime, not at import time. This allows the store app to build without a database. If `DATABASE_URL` is not set when the client is first used, an error is thrown.

## Schema Management

This package uses a multi-file Prisma schema located in the `prisma/` directory:

| File | Contents |
|---|---|
| `schema.prisma` | Datasource and generator configuration |
| `modules.prisma` | Module data models |
| `auth.prisma` | Authentication models (better-auth) |
| `assets.prisma` | Asset and media models |
| `logs.prisma` | Logging models |
| `webhooks.prisma` | Webhook models |

### Generate client

```sh
# Run from packages/core/
bunx prisma generate
```

### Run migrations

```sh
# Run from packages/db/
bunx prisma migrate dev
```

## API Reference

### `db`

Lazy-initialized `PrismaClient` proxy. The actual connection is created on first property access. In non-production environments, the client is cached on `globalThis` to survive hot module reloads.

### `Prisma`

Re-exported Prisma namespace providing access to types, enums, and utilities like `Prisma.JsonValue`, `Prisma.sql`, etc.

## Notes

- The Prisma client is generated in `packages/core/src/prisma/` (gitignored) and imported via `@86d-app/core/prisma`.
- Always use the `db` export from this package rather than instantiating `PrismaClient` directly.
- The seed script (`src/seed.ts`) seeds the luxury-house demo catalog for development and E2E.
- Run `bun run seed` from this package or `bun run db:seed` from the repo root.
