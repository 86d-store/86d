# Store Locator Module

Physical store location management with proximity search, hours tracking, and click-and-collect support. Omnichannel bridge for brands with brick-and-mortar presence.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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
