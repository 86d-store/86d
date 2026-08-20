# Announcements Module

Site-wide announcement bars, promotional banners, and popup notices with scheduling, audience targeting, and engagement analytics.

## Structure

```
src/
  index.ts          Factory: announcements(options?) => Module + admin nav
  schema.ts         ModuleSchema: announcement entity
  service.ts        AnnouncementsController interface + Announcement type
  service-impl.ts   Controller implementation (isInScheduleWindow helper)
  mdx.d.ts          MDX module declarations
  store/
    components/
      _hooks.ts           useAnnouncementsApi() store API hook
      announcement-bar.tsx  Customer-facing announcement bar component
      index.tsx            Store component exports
    endpoints/
      get-active.ts       GET  /announcements/active
      record-impression.ts POST /announcements/:id/impression
      record-click.ts      POST /announcements/:id/click
      record-dismissal.ts  POST /announcements/:id/dismiss
      index.ts             Store endpoint barrel
  admin/
    components/
      announcement-list.tsx    List view with stats + filters
      announcement-detail.tsx  Detail view with toggle/delete
      announcement-form.tsx    Create/edit form
      index.ts                 Admin component exports
    endpoints/
      list-announcements.ts    GET    /admin/announcements
      create-announcement.ts   POST   /admin/announcements/create
      get-announcement.ts      GET    /admin/announcements/:id
      update-announcement.ts   PUT    /admin/announcements/:id/update
      delete-announcement.ts   DELETE /admin/announcements/:id/delete
      reorder.ts               POST   /admin/announcements/reorder
      stats.ts                 GET    /admin/announcements/stats
      index.ts                 Admin endpoint barrel
  __tests__/
    service-impl.test.ts   55 tests covering all controller methods
```

## Options

```ts
AnnouncementsOptions {
  maxActiveAnnouncements?: number  // default 5
}
```

## Data model

- **announcement**: id, title, content, type (bar|banner|popup), position (top|bottom), linkUrl?, linkText?, backgroundColor?, textColor?, iconName?, priority, isActive, isDismissible, startsAt?, endsAt?, targetAudience (all|authenticated|guest), impressions, clicks, dismissals, metadata, createdAt, updatedAt

## Key patterns

- Schedule window: `startsAt`/`endsAt` control visibility. Both optional — missing = unbounded.
- Audience targeting: `all` shows to everyone, `authenticated`/`guest` filter by login state.
- Priority ordering: lower numbers appear first. `reorderAnnouncements()` reassigns priority by array index.
- Analytics: `recordImpression`, `recordClick`, `recordDismissal` increment counters. `getStats()` computes rates.
- `updateAnnouncement` preserves analytics counters — only content/config fields can be changed.
- All `record*` methods silently no-op for non-existent IDs (fire-and-forget from frontend).

## Gotchas

- `updateAnnouncement` uses `??` coalescing — cannot set optional fields to `undefined` once set. Pass explicit values instead.
- `isActive: false` via `updateAnnouncement` is the only way to deactivate; `getActiveAnnouncements` checks both `isActive` and schedule window.
- `getStats().clickRate` and `dismissRate` are rounded to 4 decimal places.
