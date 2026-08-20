# Appointments Module

Service-based booking with staff scheduling, time-slot availability, and customer appointment management. Enables stores to offer bookable services (salons, consultations, classes, etc.).

## Structure

```
src/
  index.ts          Factory: appointments(options?) => Module + admin nav registration
  schema.ts         Zod models: service, staff, staffService, schedule, appointment
  service.ts        AppointmentController interface + types
  service-impl.ts   AppointmentController implementation
  store/endpoints/
    list-services.ts        GET  /appointments/services
    get-service.ts          GET  /appointments/services/:slug
    get-available-slots.ts  GET  /appointments/availability
    book-appointment.ts     POST /appointments/book
    get-appointment.ts      GET  /appointments/:id
    cancel-appointment.ts   POST /appointments/:id/cancel
  admin/components/
    index.tsx               Admin UI (AppointmentList, AppointmentDetail, ServiceList, StaffList) — "use client"
  admin/endpoints/
    list-services.ts        GET  /admin/appointments/services
    create-service.ts       POST /admin/appointments/services/create
    get-service.ts          GET  /admin/appointments/services/:id
    update-service.ts       POST /admin/appointments/services/:id/update
    delete-service.ts       POST /admin/appointments/services/:id/delete
    list-staff.ts           GET  /admin/appointments/staff
    create-staff.ts         POST /admin/appointments/staff/create
    update-staff.ts         POST /admin/appointments/staff/:id/update
    delete-staff.ts         POST /admin/appointments/staff/:id/delete
    assign-service.ts       POST /admin/appointments/staff/:id/services/assign
    set-schedule.ts         POST /admin/appointments/staff/:id/schedule
    list-appointments.ts    GET  /admin/appointments
    get-appointment.ts      GET  /admin/appointments/:id
    update-appointment.ts   POST /admin/appointments/:id/update
    get-stats.ts            GET  /admin/appointments/stats
```

## Options

```ts
AppointmentsOptions {
  defaultCurrency?: string   // default "USD"
  minAdvanceMinutes?: number // minimum advance booking time
}
```

## Data models

- **service**: id, name, slug (unique), description?, duration (minutes), price, currency, status (active|inactive), maxCapacity, sortOrder
- **staff**: id, name, email (unique), bio?, status (active|inactive)
- **staffService**: id, staffId (FK), serviceId (FK) — junction table
- **schedule**: id, staffId (FK), dayOfWeek (0-6), startTime ("HH:MM"), endTime ("HH:MM") — upserts by staffId+dayOfWeek
- **appointment**: id, serviceId (FK), staffId (FK), customerId?, customerName, customerEmail, customerPhone?, startsAt, endsAt (auto-calculated), status (pending|confirmed|cancelled|completed|no-show), notes?, price, currency

## Patterns

- Availability uses UTC date methods (`getUTCDay`, `setUTCHours`) for timezone consistency
- `endsAt` is auto-calculated from `startsAt + service.duration`
- Schedule upserts by `staffId + dayOfWeek` — one schedule entry per staff per day
- Staff-service assignments are idempotent — duplicate `assignService` returns existing
- Cascading deletes: deleting staff removes assignments + schedules; deleting service removes assignments
- Cancelled appointments are excluded from availability conflict checks
- Stats revenue only counts completed appointments
