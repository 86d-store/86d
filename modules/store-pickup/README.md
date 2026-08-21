<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/store-pickup](https://86d.app/docs/modules/store-pickup)

# @86d-app/store-pickup

Buy Online, Pick Up In Store (BOPIS) module for 86d. Lets merchants define physical pickup locations with time windows, and customers schedule order pickups with capacity management.

## Installation

```ts
import storePickup from "@86d-app/store-pickup";

const module = storePickup({
  defaultPreparationMinutes: 60,
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPreparationMinutes` | `number` | `60` | Default preparation time in minutes for new locations |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store-pickup/locations` | List active pickup locations |
| GET | `/store-pickup/locations/:locationId/windows` | Available windows for a location on a date |
| POST | `/store-pickup/schedule` | Schedule a pickup for an order |
| GET | `/store-pickup/order/:orderId` | Get active pickup for an order |
| POST | `/store-pickup/:id/cancel` | Cancel a scheduled pickup |

## Admin endpoints

### Locations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-pickup/locations` | List locations (filter by active) |
| POST | `/admin/store-pickup/locations/create` | Create a location |
| GET | `/admin/store-pickup/locations/:id` | Get location detail |
| POST | `/admin/store-pickup/locations/:id/update` | Update a location |
| POST | `/admin/store-pickup/locations/:id/delete` | Delete a location |

### Windows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-pickup/windows` | List windows (requires locationId) |
| POST | `/admin/store-pickup/windows/create` | Create a pickup window |
| POST | `/admin/store-pickup/windows/:id/update` | Update a window |
| POST | `/admin/store-pickup/windows/:id/delete` | Delete a window |

### Pickups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-pickup/pickups` | List pickups (filter by status, location, date) |
| GET | `/admin/store-pickup/pickups/:id` | Get pickup detail |
| POST | `/admin/store-pickup/pickups/:id/status` | Update pickup status |
| POST | `/admin/store-pickup/pickups/:id/cancel` | Cancel a pickup |

### Blackout dates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-pickup/blackouts` | List blackouts (requires locationId) |
| POST | `/admin/store-pickup/blackouts/create` | Create a blackout date |
| POST | `/admin/store-pickup/blackouts/:id/delete` | Delete a blackout |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-pickup/summary` | Pickup analytics summary |

## Controller API

```ts
interface StorePickupController {
  // Locations
  createLocation(params): Promise<PickupLocation>
  updateLocation(id, params): Promise<PickupLocation | null>
  getLocation(id): Promise<PickupLocation | null>
  listLocations(params?): Promise<PickupLocation[]>
  deleteLocation(id): Promise<boolean>

  // Windows
  createWindow(params): Promise<PickupWindow>
  updateWindow(id, params): Promise<PickupWindow | null>
  getWindow(id): Promise<PickupWindow | null>
  listWindows(params): Promise<PickupWindow[]>
  deleteWindow(id): Promise<boolean>

  // Pickups
  schedulePickup(params): Promise<PickupOrder>
  getPickup(id): Promise<PickupOrder | null>
  getOrderPickup(orderId): Promise<PickupOrder | null>
  listPickups(params?): Promise<PickupOrder[]>
  updatePickupStatus(id, status): Promise<PickupOrder | null>
  cancelPickup(id): Promise<PickupOrder | null>

  // Availability
  getAvailableWindows(params): Promise<WindowAvailability[]>
  getWindowBookingCount(windowId, date): Promise<number>

  // Blackouts
  createBlackout(params): Promise<PickupBlackout>
  deleteBlackout(id): Promise<boolean>
  listBlackouts(locationId): Promise<PickupBlackout[]>
  isBlackoutDate(locationId, date): Promise<boolean>

  // Analytics
  getSummary(): Promise<StorePickupSummary>
}
```

## Pickup status lifecycle

```
scheduled → preparing → ready → picked_up
    ↓           ↓         ↓
 cancelled   cancelled  cancelled
```

- **scheduled** — Customer has reserved a pickup slot
- **preparing** — Staff is preparing the order
- **ready** — Order is ready for customer collection
- **picked_up** — Customer has collected the order (terminal)
- **cancelled** — Pickup was cancelled (terminal)

## Types

Key types exported from the module:

- `PickupLocation` — Physical store location
- `PickupWindow` — Time window for a specific day of week at a location
- `PickupOrder` — A scheduled pickup reservation
- `PickupBlackout` — Date when a location is unavailable
- `PickupOrderStatus` — `"scheduled" | "preparing" | "ready" | "picked_up" | "cancelled"`
- `WindowAvailability` — Window with booking count and remaining capacity
- `StorePickupSummary` — Aggregate analytics across all locations

## Admin components

- **LocationList** — Table of all pickup locations with summary stats
- **LocationDetail** — Single location view with its pickup windows
- **PickupQueue** — Filterable list of all pickup orders with status badges

## Store components

- **LocationPicker** — Customer-facing location selector with date-based window availability

## Notes

- Pickup windows are scoped to locations — you must specify `locationId` when listing or creating windows
- Blackout dates are per-location, not global
- Capacity enforcement counts only non-cancelled pickups
- Pickup orders denormalize location name/address and window times at creation for historical accuracy
- The module requires the `orders` module
