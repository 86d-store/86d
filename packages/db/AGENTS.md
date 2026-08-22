# DB

Drizzle client singleton for the Store Runtime (`drizzle-orm/node-postgres` with a lazy `pg.Pool`).

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Schema ownership (framework tables vs Module DDL) is in the parent Module and runtime section.
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests and seed paths while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

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

- From this package: `bun run seed`
- From repo root: `bun run db:seed`
- Applies compiled Module DDL, then writes typed `mod_*` rows and valid `core.*` money rows

## Gotchas

- Modules never import a database client — always `ModuleDataService`
- Never use `drizzle-kit push` / `db push` in Docker or boot
