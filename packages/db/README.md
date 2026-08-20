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

Database package for the Store Runtime. Provides a lazy Drizzle client over `pg.Pool`, framework + `core.*` schema, migrations, and demo seed.

## Installation

```sh
npm install db
```

## Usage

```ts
import { db, getPool } from "db";
import { user } from "db/schema";
import { eq } from "drizzle-orm";

const rows = await db.select().from(user).where(eq(user.email, "admin@example.com"));
```

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (runtime) | PostgreSQL connection string |

The client is **lazy-initialized** — created on first access, not at import time — so the store app can build without a database. If `DATABASE_URL` is missing when the client is first used, an error is thrown.

## Schema Management

Framework tables and `core.*` live under `src/schema/` and are migrated with Drizzle Kit:

```sh
# From packages/db/
bun run migrate

# From repo root
bun run db:migrate
```

Compiled Module tables (`mod_*`) are applied at Store boot from Zod + `col` (or the compiler adapter for Modules not yet rewritten).

## Notes

- Prefer `import { db } from "db"` and table imports from `db/schema`.
- Seed (`src/seed.ts`) loads the luxury-house demo catalog for development and E2E.
- Run `bun run seed` from this package or `bun run db:seed` from the repo root.
