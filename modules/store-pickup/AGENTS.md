# store-pickup

BOPIS (Buy Online, Pick Up In Store) module. Manages pickup locations, time windows, and order pickup lifecycle.

## File structure

```
src/
  index.ts              Module factory + re-exports
  schema.ts             4 models: pickupLocation, pickupWindow, pickupOrder, pickupBlackout
  service.ts            Types + StorePickupController interface
  service-impl.ts       Controller implementation
  mdx.d.ts              MDX type declarations
  store/
    endpoints/          5 customer endpoints (locations, windows, schedule, order, cancel)
    components/         LocationPicker (.tsx + .mdx)
  admin/
    endpoints/          17 admin endpoints (locations, windows, pickups, blackouts, summary)
    components/         LocationList, LocationDetail, PickupQueue (.tsx + .mdx)
  __tests__/
    service-impl.test.ts   120 tests
```

## Data models

- **pickupLocation** — physical store with address, contact, coordinates, preparationMinutes
- **pickupWindow** — time slot per location per day of week with capacity
- **pickupOrder** — reservation linking order → location + window, with status lifecycle
- **pickupBlackout** — per-location date blocks

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultPreparationMinutes` | `number` | `60` | Default prep time for new locations |

## Status lifecycle

```
scheduled → preparing → ready → picked_up
    ↓           ↓         ↓
 cancelled   cancelled  cancelled
```

Transitions enforced by `STATUS_TRANSITIONS` map in service-impl.ts.

## Key patterns

- Windows scoped to locations — `listWindows` requires `locationId`
- Blackouts are per-location, not global
- Capacity counts only non-cancelled pickups
- Pickup orders denormalize location name/address and window times at creation
- `getOrderPickup` returns the active (non-cancelled, non-completed) pickup
- `exactOptionalPropertyTypes` is on — endpoints use conditional assignment, not direct object spread

## Dependencies

- Requires: `orders`
- Controller key: `storePickup`
