# Kiosk Module

Kiosk station registration and legacy lifecycle-record inspection. The public terminal is a static unavailable surface. Public sessions, health, commerce actions, and station deletion remain unavailable until complete authoritative Workflows own them.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: kiosk(options?) => Module + admin nav (Sales, 2 pages)
  schema.ts         Legacy-compatible Zod models: kioskStation, kioskSession
  service.ts        KioskController interface
  service-impl.ts   Registration, legacy reads, and neutral statistics
  store/endpoints/  Empty; no unauthenticated kiosk endpoints
  store/components/ Static unavailable terminal
  admin/endpoints/
    /admin/kiosk/stations              List registration projections
    /admin/kiosk/station-options       List complete health-free registration filter options
    /admin/kiosk/stations/create       Register station
    /admin/kiosk/stations/:id          Update station registration
    /admin/kiosk/sessions              List qualified legacy lifecycle projections
    /admin/kiosk/stats                 Get neutral record counts
  admin/components/  Overview and station/session table, form, row-action, and state helpers
  __tests__/         Service, endpoint, route-exposure, and terminal containment suites
```

## Options

`idleTimeout`, `enableTipping`, and `defaultTipPercents` are accepted only for configuration compatibility. They do not enable public sessions, timeout behavior, tipping, or terminal actions.

## Data models

- **KioskStation** — registration fields plus legacy `isOnline`, `lastHeartbeat`, and `currentSessionId` storage fields; health/current-session fields are never projected by admin endpoints
- **KioskSession** — legacy lifecycle record; item, money, payment, and `completed` fields are storage compatibility only and are not projected as commerce truth
- **StationStats** — neutral lifecycle counts plus completion and revenue compatibility fields fixed at 0
- **OverallStats** — neutral record counts plus online, completion, and revenue compatibility fields fixed at 0

## Patterns

- `/kiosk/:stationId` is static: no browser capability, API request, session, heartbeat, timer, or durable mutation
- `storeEndpoints` stays empty until authoritative public Workflows exist
- Station create, update, and list responses project registration fields only
- Station filter options project only IDs, names, and optional locations
- Admin session responses prefix every stored lifecycle status with `legacy-` and omit item, money, and payment fields
- Admin record tables use TanStack Table with server-complete paging over stable batched reads; table controls persist per table
- Station update uses an owner-local row-locking transaction; missing locking and invalid durable state fail closed
- Public lifecycle, station health, item, pricing, Checkout, Payment, Order, station deletion, completion stats, and revenue reporting are unavailable
- No cross-Module events or exports are declared
