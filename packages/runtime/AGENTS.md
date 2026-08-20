# Runtime

Store runtime engine. The bridge between sandboxed modules and the real platform. Modules never see the database client, env vars, or each other — they only see what the runtime provides.

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
- Wires up adapters, authentication, and data services per request
- Injects only the current Module's options from platform config — modules never read env vars or another Module's configuration

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

Boot is resilient — individual module failures don't crash the store:
- If a module's `init()` throws, it's marked as "error" and skipped
- Modules depending on a failed module are also marked as "error"
- Boot only throws if ALL modules fail (zero successful initializations)
- `getHealth()` returns status "error" when any module has errors (but store still serves)
- `createRequestContext(moduleId)` returns only the successfully initialized owner's resources

## Key details

- Depends on: `@86d-app/core`, `better-call`, `packages/db`, `drizzle-orm`
- This is the ONLY package that touches both the module world and the platform world
- `CompiledModuleDataService` implements the `ModuleDataService` interface modules consume
