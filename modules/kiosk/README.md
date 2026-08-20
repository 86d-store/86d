<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Kiosk Module

📚 **Documentation:** [86d.app/docs/modules/kiosk](https://86d.app/docs/modules/kiosk)

Self-service kiosk management for 86d. Register kiosk stations, manage ordering sessions with cart operations, process payments, and track station health via heartbeats.

## Installation

```sh
npm install @86d-app/kiosk
```

## Usage

```ts
import kiosk from "@86d-app/kiosk";

const module = kiosk({
  idleTimeout: "120",
  enableTipping: "true",
  defaultTipPercents: "15,18,20,25",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `idleTimeout` | `string` | `"120"` | Idle timeout in seconds |
| `enableTipping` | `string` | `"true"` | Enable tipping on kiosks |
| `defaultTipPercents` | `string` | `"15,18,20,25"` | Comma-separated tip percentages |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/kiosk/sessions` | Start a new session |
| GET | `/kiosk/sessions/:id` | Get session by ID |
| POST | `/kiosk/sessions/:id/items` | Add item to session |
| POST | `/kiosk/sessions/:id/items/:itemId/delete` | Remove item from session |
| POST | `/kiosk/sessions/:id/items/:itemId` | Update item quantity |
| POST | `/kiosk/sessions/:id/complete` | Complete session with payment |
| POST | `/kiosk/stations/:id/heartbeat` | Send station heartbeat |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/kiosk/stations` | List all stations |
| POST | `/admin/kiosk/stations/create` | Register a new station |
| POST | `/admin/kiosk/stations/:id` | Update a station |
| POST | `/admin/kiosk/stations/:id/delete` | Delete a station |
| GET | `/admin/kiosk/sessions` | List all sessions |
| GET | `/admin/kiosk/stats` | Get overall kiosk stats |

## Controller API

```ts
interface KioskController extends ModuleController {
  registerStation(params: { name: string; location?: string; settings?: Record<string, unknown> }): Promise<KioskStation>;
  updateStation(id: string, params: { name?: string; location?: string; isActive?: boolean; settings?: Record<string, unknown> }): Promise<KioskStation | null>;
  deleteStation(id: string): Promise<boolean>;
  listStations(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<KioskStation[]>;
  getStation(id: string): Promise<KioskStation | null>;
  heartbeat(stationId: string): Promise<KioskStation | null>;

  startSession(stationId: string): Promise<KioskSession | null>;
  addItem(sessionId: string, item: { name: string; price: number; quantity: number }): Promise<KioskSession | null>;
  removeItem(sessionId: string, itemId: string): Promise<KioskSession | null>;
  updateItemQuantity(sessionId: string, itemId: string, quantity: number): Promise<KioskSession | null>;
  getSession(id: string): Promise<KioskSession | null>;
  completeSession(id: string, paymentMethod: string): Promise<KioskSession | null>;
  abandonSession(id: string): Promise<KioskSession | null>;
  listSessions(params?: { stationId?: string; status?: SessionStatus; take?: number; skip?: number }): Promise<KioskSession[]>;

  getStationStats(stationId: string): Promise<StationStats>;
  getOverallStats(): Promise<OverallStats>;
}
```

## Types

```ts
type SessionStatus = "active" | "completed" | "abandoned" | "timed-out";
type PaymentStatus = "pending" | "paid" | "failed";

interface KioskStation {
  id: string;
  name: string;
  location?: string;
  isOnline: boolean;
  isActive: boolean;
  lastHeartbeat?: Date;
  currentSessionId?: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface KioskItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: Array<Record<string, unknown>>;
}

interface KioskSession {
  id: string;
  stationId: string;
  status: SessionStatus;
  items: KioskItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

interface StationStats {
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  totalRevenue: number;
}

interface OverallStats {
  totalStations: number;
  onlineStations: number;
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  totalRevenue: number;
}
```

## Notes

- Tax is automatically calculated at 8% on the subtotal when items are added, removed, or updated.
- Starting a session requires the station to be active; the session is linked to the station via `currentSessionId`.
- Completing or abandoning a session clears the station's `currentSessionId`.
- Only `active` sessions allow item modifications (add, remove, update quantity).
- Setting quantity to 0 or below removes the item from the session.
- Station heartbeat sets `isOnline` to `true` and updates `lastHeartbeat` timestamp.
- Two admin pages: "Kiosks" (overview dashboard) and "Stations" (station management).
- Events emitted: `kiosk.session.started`, `kiosk.session.ended`, `kiosk.order.paid`, `kiosk.registered`, `kiosk.heartbeat`.
