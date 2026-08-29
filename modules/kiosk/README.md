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

📚 **Documentation:** [86d.app/docs/modules/kiosk](https://86d.app/docs/modules/kiosk)

# Kiosk module

Kiosk station registration and legacy lifecycle-record inspection for 86d. The public kiosk terminal is a static unavailable surface. Public sessions, station health, item selection, pricing, checkout, payment, order creation, and station deletion are unavailable until complete authoritative Workflows own them.

## Installation

```sh
npm install @86d-app/kiosk
```

## Usage

```ts
import kiosk from "@86d-app/kiosk";

const module = kiosk();
```

The legacy `idleTimeout`, `enableTipping`, and `defaultTipPercents` options remain accepted for configuration compatibility but have no public behavior while sessions and tipping are unavailable.

## Store surface

The module exposes no store endpoints. `/kiosk/:stationId` renders a static status explaining that kiosk sessions and commerce actions are unavailable. It does not create a browser capability, call an API, start a session, report station health, or mutate durable state.

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/kiosk/stations` | Search, filter, sort, and page health-free station registration projections |
| GET | `/admin/kiosk/station-options` | List complete health-free registration options for the legacy-session filter |
| POST | `/admin/kiosk/stations/create` | Register a station |
| PUT | `/admin/kiosk/stations/:id` | Update a station registration |
| GET | `/admin/kiosk/sessions` | Search, filter, sort, and page qualified legacy lifecycle projections |
| GET | `/admin/kiosk/stats` | Get neutral kiosk record counts |

Create, update, and list station responses omit legacy `isOnline`, `lastHeartbeat`, and `currentSessionId` fields. Session responses omit items, money, and payment fields and prefix every stored lifecycle status with `legacy-`.

## Controller API

```ts
interface KioskController extends ModuleController {
  registerStation(params: { name: string; location?: string; settings?: Record<string, unknown> }): Promise<KioskStation>;
  updateStation(id: string, params: { name?: string; location?: string | null; isActive?: boolean; settings?: Record<string, unknown> }): Promise<KioskStation | null>;
  listStations(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<KioskStation[]>;
  listStationAdminPage(params?: KioskStationAdminListParams): Promise<KioskStationAdminListPage>;
  getStation(id: string): Promise<KioskStation | null>;
  listSessions(params?: { stationId?: string; status?: SessionStatus; take?: number; skip?: number }): Promise<KioskSession[]>;
  listSessionAdminPage(params?: KioskSessionAdminListParams): Promise<KioskSessionAdminListPage>;
  getStationStats(stationId: string): Promise<StationStats>;
  getOverallStats(): Promise<OverallStats>;
}
```

The controller types retain legacy station-health, item, money, payment, and completion fields solely so pre-withdrawal durable rows can still be parsed. Merchant-facing endpoints do not project those fields as current facts. The stats endpoint projects only station registration and qualified legacy session-record counts.

Admin list methods apply search, filters, ordering, and pagination after stable ID-ordered reads of the complete durable set. A concurrent registration change may appear on the next refresh while a multi-batch admin read is in progress.

Station updates require an owner-local transaction with row locking. Missing locking or malformed durable records fail closed with `KioskMutationUnavailableError`.
Passing `location: null` clears a saved station location; omitting `location` leaves it unchanged.

## Containment notes

- There are no public kiosk endpoints and no public lifecycle or health mutations.
- Item selection, pricing, tax, tipping, Payment creation, Checkout completion, and Order creation are unavailable.
- Station deletion is unavailable until a complete destructive Workflow owns it.
- Every stored session status is a legacy state, not evidence of a current public session or of Checkout, Payment, or Order completion.
- Admin session projections prefix every status with `legacy-` and omit item, money, and payment data.
- Admin station projections omit stored health and current-session fields.
- The module declares no cross-module events or exports.
