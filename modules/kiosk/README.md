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

# Kiosk Module

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

## Store Surface

The Module exposes no store endpoints. `/kiosk/:stationId` renders a static status explaining that kiosk sessions and commerce actions are unavailable. It does not create a browser capability, call an API, start a session, report station health, or mutate durable state.

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/kiosk/stations` | List health-free station registration projections |
| POST | `/admin/kiosk/stations/create` | Register a station |
| PUT | `/admin/kiosk/stations/:id` | Update a station registration |
| GET | `/admin/kiosk/sessions` | List qualified legacy lifecycle projections |
| GET | `/admin/kiosk/stats` | Get neutral kiosk record counts |

Create, update, and list station responses omit legacy `isOnline`, `lastHeartbeat`, and `currentSessionId` fields. Session responses omit items, money, and payment fields and map stored `completed` to `legacy-completed`.

## Controller API

```ts
interface KioskController extends ModuleController {
  registerStation(params: { name: string; location?: string; settings?: Record<string, unknown> }): Promise<KioskStation>;
  updateStation(id: string, params: { name?: string; location?: string; isActive?: boolean; settings?: Record<string, unknown> }): Promise<KioskStation | null>;
  listStations(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<KioskStation[]>;
  getStation(id: string): Promise<KioskStation | null>;
  listSessions(params?: { stationId?: string; status?: SessionStatus; take?: number; skip?: number }): Promise<KioskSession[]>;
  getStationStats(stationId: string): Promise<StationStats>;
  getOverallStats(): Promise<OverallStats>;
}
```

The controller types retain legacy station-health, item, money, payment, and completion fields solely so pre-withdrawal durable rows can still be parsed. Merchant-facing endpoints do not project those fields as current facts. Completion, revenue, and online compatibility statistics are fixed at `0`.

Station updates require an owner-local transaction with row locking. Missing locking or malformed durable records fail closed with `KioskMutationUnavailableError`.

## Containment Notes

- There are no public kiosk endpoints and no public lifecycle or health mutations.
- Item selection, pricing, tax, tipping, Payment creation, Checkout completion, and Order creation are unavailable.
- Station deletion is unavailable until a complete destructive Workflow owns it.
- Stored `completed` is a legacy state, not evidence of Checkout, Payment, or Order completion.
- Admin session projections use `legacy-completed` and omit item, money, and payment data.
- Admin station projections omit stored health and current-session fields.
- The Module declares no cross-Module events or exports.
