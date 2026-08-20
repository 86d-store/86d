# Kiosk Module

Self-service kiosk station management with session-based ordering, item management, and payment tracking.

## Structure

```
src/
  index.ts          Factory: kiosk(options?) => Module + admin nav (Sales, 2 pages)
  schema.ts         Zod models: kioskStation, kioskSession
  service.ts        KioskController interface
  service-impl.ts   KioskController implementation (auto tax calc at 8%)
  store/endpoints/
    /kiosk/sessions                           Start session
    /kiosk/sessions/:id                       Get session
    /kiosk/sessions/:id/items                 Add item
    /kiosk/sessions/:id/items/:itemId/delete  Remove item
    /kiosk/sessions/:id/items/:itemId         Update item quantity
    /kiosk/sessions/:id/complete              Complete session (pay)
    /kiosk/stations/:id/heartbeat             Station heartbeat
  store/components/  index.tsx
  admin/endpoints/
    /admin/kiosk/stations              List stations
    /admin/kiosk/stations/create       Create station
    /admin/kiosk/stations/:id          Update station
    /admin/kiosk/stations/:id/delete   Delete station
    /admin/kiosk/sessions              List sessions
    /admin/kiosk/stats                 Get overall stats
  admin/components/  kiosk-admin.tsx, kiosk-admin.mdx, kiosk-stations.tsx, kiosk-stations.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface KioskOptions extends ModuleConfig {
  idleTimeout?: string;        // Idle timeout in seconds (default: "120")
  enableTipping?: string;      // Enable tipping (default: "true")
  defaultTipPercents?: string; // Comma-separated tip % (default: "15,18,20,25")
}
```

## Data models

- **KioskStation** — id, name, location, isOnline, isActive, lastHeartbeat, currentSessionId, settings (JSON)
- **KioskSession** — id, stationId, status (active|completed|abandoned|timed-out), items (KioskItem[]), subtotal, tax, tip, total, paymentMethod, paymentStatus (pending|paid|failed), startedAt, completedAt
- **KioskItem** — id, name, price, quantity, modifiers
- **StationStats** — totalSessions, completedSessions, abandonedSessions, totalRevenue
- **OverallStats** — totalStations, onlineStations, totalSessions, completedSessions, abandonedSessions, totalRevenue

## Patterns

- Two admin pages: "Kiosks" (overview/stats) and "Stations" (manage stations)
- Station heartbeat sets `isOnline=true` and updates `lastHeartbeat`
- Session start requires station to be active; links session to station via `currentSessionId`
- Items auto-recalculate subtotal, tax (8%), and total on add/remove/update
- Complete session sets `paymentStatus=paid` and clears station's `currentSessionId`
- Abandon session clears station's `currentSessionId`
- Events emitted: `kiosk.session.started`, `kiosk.session.ended`, `kiosk.order.placed`, `kiosk.order.paid`, `kiosk.registered`, `kiosk.heartbeat`
- Exports read values: `kioskSessionStatus`, `kioskStationOnline`
- Only active sessions allow item modifications
