# DB

Drizzle client singleton for the Store Runtime, using `drizzle-orm/node-postgres` with a lazy `pg.Pool`.

## Structure

```
src/
  index.ts        Lazy Drizzle client (global cache for HMR)
  seed.ts         Active demo seed script (luxury-house catalog)
  core-money.ts   Helpers for core.party / subject / transaction
  schema/         Framework tables, core schema, compiled-table helpers
drizzle/          SQL migrations (drizzle-kit migrate)
seed/             Seed data definitions and assets
```

## Key exports

- `db` — lazy-initialized Drizzle proxy (cached on `globalThis` in non-production)
- Schema tables and `core.*` re-exports
- `writeCoreMoney` — upsert party/subject/transaction for money owners
- `getPool()` — underlying `pg.Pool` for migrate/seed/boot DDL

## Seed

- `bun run seed` from this package (or `bun run db:seed` from repo root)
- Applies compiled Module DDL, then writes typed `mod_*` rows and valid `core.*` money rows

## Gotchas

- Do NOT import a database client in Modules — always use `ModuleDataService`
- Never use `drizzle-kit push` / `db push` in Docker or boot
