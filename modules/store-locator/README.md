

# @86d-app/store-locator

📚 **Documentation:** [86d.app/docs/modules/store-locator](https://86d.app/docs/modules/store-locator)

Physical store location management module for the 86d commerce platform. Enables brands with brick-and-mortar presence to manage store locations, provide proximity-based search, display operating hours, and support click-and-collect (BOPIS).

## Installation

```ts
import storeLocator from "@86d-app/store-locator";

const module = storeLocator({
  defaultRadiusKm: 50,
  defaultUnit: "km",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultRadiusKm` | `number` | `50` | Default search radius in kilometers |
| `maxNearbyResults` | `number` | `20` | Maximum results for nearby search |
| `defaultUnit` | `"km" \| "mi"` | `"km"` | Default distance unit for results |

## Store endpoints

Customer-facing endpoints (active locations only):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | List all active locations (filterable by country, region, city, pickup, featured) |
| GET | `/locations/nearby` | Search by proximity (lat, lng, radius, unit, limit, pickup) |
| GET | `/locations/regions` | List distinct regions and countries |
| GET | `/locations/:slug` | Get location details by slug |
| GET | `/locations/:id/hours` | Check if a location is currently open |

### Query parameters

**GET /locations**
- `country` — Filter by country code
- `region` — Filter by region name
- `city` — Filter by city
- `pickup=true` — Only pickup-enabled locations
- `featured=true` — Only featured locations
- `limit`, `offset` — Pagination

**GET /locations/nearby**
- `lat` (required) — Latitude (-90 to 90)
- `lng` (required) — Longitude (-180 to 180)
- `radius` — Search radius in km (default: 50)
- `unit` — Distance unit: `km` or `mi` (default: km)
- `limit` — Max results (default: 20)
- `pickup=true` — Only pickup-enabled locations

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/store-locator/locations` | List all locations (with filters) |
| POST | `/admin/store-locator/locations/create` | Create a new location |
| GET | `/admin/store-locator/locations/:id` | Get location by ID |
| POST | `/admin/store-locator/locations/:id/update` | Update a location |
| DELETE | `/admin/store-locator/locations/:id/delete` | Delete a location |
| GET | `/admin/store-locator/stats` | Get location statistics |

## Admin pages

| Path | Component | Label | Group |
|------|-----------|-------|-------|
| `/admin/store-locator` | LocationList | Locations | Content |
| `/admin/store-locator/new` | LocationForm | — | — |
| `/admin/store-locator/:id` | LocationDetail | — | — |
| `/admin/store-locator/:id/edit` | LocationForm | — | — |

## Controller API

```ts
interface StoreLocatorController {
  createLocation(params): Promise<Location>;
  getLocation(id: string): Promise<Location | null>;
  getLocationBySlug(slug: string): Promise<Location | null>;
  listLocations(opts?): Promise<Location[]>;
  updateLocation(id: string, data): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  searchNearby(params): Promise<LocationWithDistance[]>;
  listRegions(): Promise<string[]>;
  listCountries(): Promise<string[]>;
  listCities(country: string): Promise<string[]>;
  isOpen(id: string): Promise<{ open: boolean; currentDay: string; hours: DayHours | null }>;
  getStats(): Promise<LocationStats>;
}
```

## Types

```ts
interface Location {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  imageUrl?: string;
  hours?: WeeklyHours;
  amenities?: string[];
  region?: string;
  isActive: boolean;
  isFeatured: boolean;
  pickupEnabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface LocationWithDistance extends Location {
  distance: number;
  unit: "km" | "mi";
}

interface WeeklyHours {
  monday?: DayHours;
  tuesday?: DayHours;
  // ... (all 7 days)
}

interface DayHours {
  open: string;   // "09:00"
  close: string;  // "21:00"
  closed?: boolean;
}
```

## Store Components

| Component | Description |
|-----------|-------------|
| `LocationList` | Displays a searchable, filterable list of store locations |
| `LocationDetail` | Shows full details for a single location including hours, amenities, and map |

### Usage

```tsx
import { LocationList, LocationDetail } from "@86d-app/store-locator/store/components";

<LocationList />
<LocationDetail slug="downtown-flagship" />
```

## Notes

- Proximity search uses the Haversine formula for accurate great-circle distances
- The `isOpen()` check uses server timezone — consider timezone offsets for geographically distributed stores
- The `radiusKm` parameter for `searchNearby` is always in kilometers; the `unit` parameter only affects the output distance values
- Store endpoints only return active locations; admin endpoints return all locations regardless of status
- Locations are sorted alphabetically by name in list views; by distance in nearby search
