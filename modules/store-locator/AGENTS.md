# Store Locator Module

Physical store location management with proximity search, hours tracking, and click-and-collect support. Omnichannel bridge for brands with brick-and-mortar presence.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts              Module factory + StoreLocatorOptions
  schema.ts             location entity (single entity, flat)
  service.ts            Location, LocationWithDistance, StoreLocatorController types
  service-impl.ts       Controller implementation (haversine distance, hours check)
  store/
    endpoints/          5 customer-facing endpoints
    components/         Customer-facing components
      _hooks.ts         API hooks (useStoreLocatorApi)
      _utils.ts         Shared utilities
      index.tsx         Component exports
      *.tsx             Component logic
      *.mdx             Component templates
  admin/endpoints/      6 admin endpoints
  admin/components/     3 TSX components (LocationList, LocationForm, LocationDetail)
  __tests__/            58 tests covering all controller methods
```

## Data model

Single entity `location` with fields: id, name, slug (unique), description, address, city, state, postalCode, country, latitude, longitude, phone, email, website, imageUrl, hours (json → WeeklyHours), amenities (json → string[]), region, isActive, isFeatured, pickupEnabled, metadata, createdAt, updatedAt.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultRadiusKm` | `number` | `50` | Default search radius for nearby queries |
| `maxNearbyResults` | `number` | `20` | Max results for nearby search |
| `defaultUnit` | `"km" \| "mi"` | `"km"` | Default distance unit |

## Patterns

- Controller registered as `storeLocator` on `ctx.context.controllers`
- Haversine formula for geo distance (service-impl.ts, ~30 lines)
- `searchNearby()` loads all matching locations then filters/sorts in memory — fine for typical store counts (<1000), would need spatial indexing for massive datasets
- Hours stored as `WeeklyHours` JSON: `{ monday: { open: "09:00", close: "21:00" }, ... }`
- `isOpen()` compares current time string (HH:MM) against day hours
- Store endpoints only return active locations; admin endpoints return all
- `exactOptionalPropertyTypes` is on — use explicit `findOpts` pattern instead of passing `undefined` to `take`/`skip`

## Caveats

- `isOpen()` uses server timezone, not location timezone — caller should account for this
- Nearby search radius param is always in km regardless of unit — unit only affects output distance values
- Admin components use `useEffect` + `hydrated` ref for form population (not `onSuccess` on useQuery)
