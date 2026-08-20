

# @86d-app/announcements

📚 **Documentation:** [86d.app/docs/modules/announcements](https://86d.app/docs/modules/announcements)

Site-wide announcement bars, promotional banners, and popup notices for the 86d commerce platform. Schedule announcements, target specific audiences, and track engagement with built-in analytics.

## Installation

```bash
bun add @86d-app/announcements
```

## Usage

```ts
import announcements from "@86d-app/announcements";

const module = announcements({
  maxActiveAnnouncements: 5,
});
```

### Store component

```tsx
import { AnnouncementBar } from "@86d-app/announcements/components";

// In your layout — shows active bar-type announcements
<AnnouncementBar audience="all" />
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxActiveAnnouncements` | `number` | `5` | Maximum announcements shown simultaneously |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/announcements/active` | Get currently visible announcements |
| `POST` | `/announcements/:id/impression` | Record an impression |
| `POST` | `/announcements/:id/click` | Record a CTA click |
| `POST` | `/announcements/:id/dismiss` | Record a dismissal |

### Query parameters for `/announcements/active`

| Parameter | Type | Description |
|-----------|------|-------------|
| `audience` | `"all" \| "authenticated" \| "guest"` | Filter by visitor type |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/announcements` | List all announcements |
| `POST` | `/admin/announcements/create` | Create a new announcement |
| `GET` | `/admin/announcements/:id` | Get announcement details |
| `PUT` | `/admin/announcements/:id/update` | Update an announcement |
| `DELETE` | `/admin/announcements/:id/delete` | Delete an announcement |
| `POST` | `/admin/announcements/reorder` | Reorder announcements by priority |
| `GET` | `/admin/announcements/stats` | Get engagement statistics |

## Controller API

### `createAnnouncement(params)`

Create a new announcement with title, content, and optional display settings.

### `getAnnouncement(id)`

Get a single announcement by ID. Returns `null` if not found.

### `listAnnouncements(opts?)`

List announcements with optional filters: `activeOnly`, `type`, `position`, `limit`, `offset`.

### `getActiveAnnouncements(opts?)`

Get announcements currently visible to visitors. Respects `isActive`, schedule window (`startsAt`/`endsAt`), and audience targeting.

### `updateAnnouncement(id, data)`

Update announcement fields. Preserves analytics counters (impressions, clicks, dismissals).

### `deleteAnnouncement(id)`

Delete an announcement permanently.

### `reorderAnnouncements(ids)`

Set display priority based on array order. First ID gets priority 0, second gets 1, etc.

### `recordImpression(id)` / `recordClick(id)` / `recordDismissal(id)`

Increment engagement counters. Silent no-op for non-existent IDs (safe for fire-and-forget from frontend).

### `getStats()`

Returns aggregate statistics:

```ts
{
  totalAnnouncements: number;
  activeAnnouncements: number;    // active + within schedule window
  scheduledAnnouncements: number; // active but startsAt is in the future
  expiredAnnouncements: number;   // endsAt is in the past
  totalImpressions: number;
  totalClicks: number;
  totalDismissals: number;
  clickRate: number;              // clicks / impressions (0-1)
  dismissRate: number;            // dismissals / impressions (0-1)
}
```

## Types

### Announcement

```ts
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "bar" | "banner" | "popup";
  position: "top" | "bottom";
  linkUrl?: string;
  linkText?: string;
  backgroundColor?: string;
  textColor?: string;
  iconName?: string;
  priority: number;
  isActive: boolean;
  isDismissible: boolean;
  startsAt?: Date;
  endsAt?: Date;
  targetAudience: "all" | "authenticated" | "guest";
  impressions: number;
  clicks: number;
  dismissals: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Notes

- **Scheduling**: Set `startsAt` and `endsAt` for time-limited promotions. Both are optional — omit `startsAt` for immediate visibility, omit `endsAt` for no expiry.
- **Audience targeting**: `"all"` shows to everyone. `"authenticated"` targets logged-in customers. `"guest"` targets anonymous visitors.
- **Display types**: `"bar"` is a thin announcement strip (top/bottom of page). `"banner"` is a wider promotional block. `"popup"` is a modal overlay.
- **Priority**: Lower numbers display first. Use `reorderAnnouncements()` for drag-and-drop ordering in admin UI.
- **Colors**: `backgroundColor` and `textColor` accept any CSS color value including OKLCH tokens.
