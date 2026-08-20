

# @86d-app/delivery-slots

📚 **Documentation:** [86d.app/docs/modules/delivery-slots](https://86d.app/docs/modules/delivery-slots)

Delivery slots module for 86d commerce platform. Allows store owners to define delivery time windows by day of week with capacity limits and optional surcharges, and customers to book a delivery slot during checkout. Supports blackout dates to block deliveries on holidays or special occasions.

## Installation

Add to your store's module configuration:

```ts
import deliverySlots from "@86d-app/delivery-slots";

export const modules = [
  deliverySlots({
    horizonDays: 14, // optional — days ahead to show slots
  }),
];
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `horizonDays` | `number` | `14` | Number of days into the future to show available slots |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/delivery-slots/available?date=YYYY-MM-DD` | List available slots for a date with remaining capacity |
| `POST` | `/delivery-slots/book` | Book a delivery slot for an order |
| `POST` | `/delivery-slots/bookings/:id/cancel` | Cancel a delivery booking |
| `GET` | `/delivery-slots/order/:orderId` | Get the confirmed delivery booking for an order |

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/delivery-slots` | List all delivery schedules (filterable by day, active) |
| `POST` | `/admin/delivery-slots/create` | Create a delivery schedule |
| `GET` | `/admin/delivery-slots/summary` | Dashboard summary stats |
| `GET` | `/admin/delivery-slots/:id` | Get schedule detail |
| `POST` | `/admin/delivery-slots/:id/update` | Update a schedule |
| `POST` | `/admin/delivery-slots/:id/delete` | Delete a schedule |
| `GET` | `/admin/delivery-slots/bookings` | List bookings (filterable by date, order, customer, status) |
| `POST` | `/admin/delivery-slots/bookings/:id/cancel` | Cancel a booking |
| `GET` | `/admin/delivery-slots/blackouts` | List all blackout dates |
| `POST` | `/admin/delivery-slots/blackouts/create` | Create a blackout date |
| `POST` | `/admin/delivery-slots/blackouts/:id/delete` | Delete a blackout date |

## Controller API

```ts
interface DeliverySlotsController {
  // Schedule CRUD
  createSchedule(params: CreateScheduleParams): Promise<DeliverySchedule>;
  updateSchedule(id: string, params: UpdateScheduleParams): Promise<DeliverySchedule | null>;
  getSchedule(id: string): Promise<DeliverySchedule | null>;
  listSchedules(params?: ListSchedulesParams): Promise<DeliverySchedule[]>;
  deleteSchedule(id: string): Promise<boolean>;

  // Booking management
  bookSlot(params: BookSlotParams): Promise<DeliveryBooking>;
  cancelBooking(id: string): Promise<DeliveryBooking | null>;
  getBooking(id: string): Promise<DeliveryBooking | null>;
  getOrderBooking(orderId: string): Promise<DeliveryBooking | null>;
  listBookings(params?: ListBookingsParams): Promise<DeliveryBooking[]>;

  // Availability
  getAvailableSlots(params: AvailableSlotsParams): Promise<SlotAvailability[]>;
  getSlotBookingCount(scheduleId: string, date: string): Promise<number>;

  // Blackout dates
  createBlackout(params: CreateBlackoutParams): Promise<DeliveryBlackout>;
  deleteBlackout(id: string): Promise<boolean>;
  listBlackouts(): Promise<DeliveryBlackout[]>;
  isBlackoutDate(date: string): Promise<boolean>;

  // Analytics
  getSummary(): Promise<DeliverySlotsSummary>;
}
```

## Types

### DeliverySchedule

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `name` | `string` | Display name (e.g. "Weekday Morning") |
| `dayOfWeek` | `number` | 0 = Sunday … 6 = Saturday |
| `startTime` | `string` | Start time in HH:MM 24-hour format |
| `endTime` | `string` | End time in HH:MM 24-hour format |
| `capacity` | `number` | Maximum bookings per slot occurrence |
| `surchargeInCents` | `number` | Surcharge in cents (0 = no surcharge) |
| `active` | `boolean` | Whether customers can book this slot |
| `sortOrder` | `number` | Display order within the same day |

### DeliveryBooking

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `scheduleId` | `string` | Associated schedule |
| `deliveryDate` | `string` | Specific delivery date (YYYY-MM-DD) |
| `orderId` | `string` | Associated order |
| `customerId` | `string?` | Customer who booked |
| `scheduleName` | `string` | Schedule name (snapshotted) |
| `startTime` | `string` | Time window start (snapshotted) |
| `endTime` | `string` | Time window end (snapshotted) |
| `surchargeInCents` | `number` | Surcharge charged (snapshotted) |
| `status` | `"confirmed" \| "cancelled"` | Booking status |
| `instructions` | `string?` | Delivery instructions |

### DeliveryBlackout

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `date` | `string` | Blocked date (YYYY-MM-DD) |
| `reason` | `string?` | Reason displayed to customers |

### SlotAvailability

| Field | Type | Description |
|-------|------|-------------|
| `schedule` | `DeliverySchedule` | The schedule |
| `date` | `string` | The queried date |
| `booked` | `number` | Confirmed booking count |
| `remaining` | `number` | Slots still available |
| `available` | `boolean` | Whether the slot can be booked |

## Notes

- Schedules define recurring weekly slots — a "Monday 08:00–12:00" schedule applies to every Monday
- Each order can have at most one confirmed delivery booking
- Surcharges are snapshotted when booked — later changes don't affect existing bookings
- Cancelled bookings free up capacity for new bookings
- Blackout dates block all deliveries regardless of schedule configuration
- All monetary amounts are in cents to avoid floating-point issues
- Booking date must match the schedule's day of week (e.g. can't book a Monday schedule for a Tuesday)
