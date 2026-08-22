# Runtime

Store runtime engine: bridge between sandboxed Modules and the real platform. Modules never see the database client, env vars, or each other — only what the runtime provides.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Capability and isolation contracts also live in [`packages/core/AGENTS.md`](../core/AGENTS.md).
2. **Implement** using the local patterns below. Keep owner-local data and capability resolution intact.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_ and Modules still cannot reach platform or sibling Module internals.

## Structure

```
src/
  adapters.ts                      Adapter implementations for module data access
  compiled-module-data-service.ts  ModuleDataService over compiled mod_* tables
  compiled-schema-boot.ts          Compile + apply Module DDL at boot
  command-drizzle.ts               Command persistence (Drizzle)
  grant-drizzle.ts                 Grant adapters (Drizzle)
  drizzle-persistence-client.ts    Shared transactional persistence client
  registry.ts                      Module registry boot and request context
```

## Responsibilities

- Implements `ModuleDataService` against compiled Postgres tables via Drizzle
- Resolves typed capability contracts before adapter or Module initialization effects
- Invokes each capability provider with only its owner Module's data, events, and options
- Wires adapters, authentication, and data services per request
- Injects only the current Module's options from platform config — Modules never read env vars or another Module's configuration

## Capability resolution

At init, the runtime:
1. Collects all capability providers and acceptances
2. Verifies provider ownership and accepted versions
3. Resolves exactly one compatible provider for each required acceptance
4. Rejects missing, duplicate, incompatible, or malformed contracts before any Store adapter is called
5. Restricts discriminated requests to the consumer's accepted operation allowlist
6. Creates an invoker pinned to each consumer's declared definition and validates both consumer and provider schemas at runtime

`ModuleContext.data`, `controllers`, and `options` are owner-local. There is no Module-visible data registry or aggregate controller registry. The legacy `exports`/`requires` validator remains only as migration compatibility metadata.

## Graceful degradation

Boot is resilient — individual Module failures do not crash the store:
- If a Module's `init()` throws, it is marked `"error"` and skipped
- Modules depending on a failed Module are also marked `"error"`
- Boot throws only if **all** Modules fail (zero successful initializations)
- `getHealth()` returns status `"error"` when any Module has errors (store still serves)
- `createRequestContext(moduleId)` returns only successfully initialized owner resources

## Local notes

- Depends on: `@86d-app/core`, `packages/db`, `drizzle-orm`
- This is the **only** package that touches both the Module world and the platform world
- `CompiledModuleDataService` implements the `ModuleDataService` interface Modules consume
