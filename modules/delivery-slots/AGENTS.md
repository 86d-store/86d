# Delivery Slots Module

Scheduled delivery time windows by day of week with capacity limits, surcharges, and blackout dates.

## File structure

```
src/
  index.ts              Module factory, options, page definitions
  schema.ts             Data models: deliverySchedule, deliveryBooking, deliveryBlackout
  service.ts            Types + DeliverySlotsController interface
  service-impl.ts       Business logic implementation
  mdx.d.ts              MDX type declaration
  admin/
    endpoints/
      index.ts              Endpoint map (11 endpoints)
      list-schedules.ts     GET  /admin/delivery-slots
      get-schedule.ts       GET  /admin/delivery-slots/:id
      create-schedule.ts    POST /admin/delivery-slots/create
      update-schedule.ts    POST /admin/delivery-slots/:id/update
      delete-schedule.ts    POST /admin/delivery-slots/:id/delete
      list-bookings.ts      GET  /admin/delivery-slots/bookings
      cancel-booking.ts     POST /admin/delivery-slots/bookings/:id/cancel
      list-blackouts.ts     GET  /admin/delivery-slots/blackouts
      create-blackout.ts    POST /admin/delivery-slots/blackouts/create
      delete-blackout.ts    POST /admin/delivery-slots/blackouts/:id/delete
      summary.ts            GET  /admin/delivery-slots/summary
    components/
      index.tsx             Re-exports
      schedule-list.tsx + .mdx    Admin list with summary cards
      schedule-detail.tsx + .mdx  Detail view
      blackout-list.tsx + .mdx    Blackout date management
  store/
    endpoints/
      index.ts               Endpoint map (4 endpoints)
      available-slots.ts     GET  /delivery-slots/available?date=YYYY-MM-DD
      book-slot.ts           POST /delivery-slots/book
      cancel-booking.ts      POST /delivery-slots/bookings/:id/cancel
      order-booking.ts       GET  /delivery-slots/order/:orderId
    components/
      index.tsx              Re-exports
      slot-picker.tsx + .mdx   Date picker + available slot grid
  __tests__/
    service-impl.test.ts   95 tests
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `horizonDays` | `number` | `14` | Number of days into the future to show available slots |

## Data models

- **deliverySchedule** — Named time window for a specific day of week. Has start/end time (HH:MM), capacity, surcharge in cents, active flag, sort order.
- **deliveryBooking** — A confirmed or cancelled booking tying an order to a schedule + date. Denormalizes schedule name, time window, and surcharge for order history.
- **deliveryBlackout** — A blocked date (YYYY-MM-DD) with optional reason. No bookings allowed on blackout dates.

## Key patterns

- Schedules define recurring weekly slots (e.g. "Monday 08:00–12:00, capacity 10")
- Bookings tie a specific date + schedule to an order
- Surcharge is **snapshotted** at booking time — updating the schedule surcharge doesn't affect existing bookings
- One confirmed booking per order (enforced; cancelled bookings don't count)
- `getAvailableSlots(date)` returns all matching schedules with remaining capacity
- Cancelled bookings free up capacity for new bookings
- Blackout dates block all deliveries regardless of schedule
- Date validation uses YYYY-MM-DD format; time uses HH:MM 24-hour format
- Day of week: 0 = Sunday, 6 = Saturday (matches JS `Date.getDay()`)
- Booking date must match the schedule's `dayOfWeek` (validated on creation)
- `exactOptionalPropertyTypes` is on — build objects conditionally, never pass `undefined`

## Gotchas

- Deleting a schedule cascades to its bookings (via schema reference)
- Inactive schedules cannot be booked but existing bookings remain valid
- Duplicate blackout dates for the same date are rejected
- Already-cancelled bookings throw when cancelled again
- Start time must be strictly before end time (no overnight slots)
