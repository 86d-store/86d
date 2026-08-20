<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Appointments Module

📚 **Documentation:** [86d.app/docs/modules/appointments](https://86d.app/docs/modules/appointments)

Service-based booking module for commerce stores. Manage bookable services, staff members, weekly schedules, availability, and customer appointments. Designed for salons, consultants, fitness studios, clinics, and any service-based business.

## Installation

```sh
npm install @86d-app/appointments
```

## Usage

```ts
import appointments from "@86d-app/appointments";

const module = appointments({
  defaultCurrency: "USD",
  minAdvanceMinutes: 60,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultCurrency` | `string` | `"USD"` | Default currency for service pricing |
| `minAdvanceMinutes` | `number` | — | Minimum advance booking time in minutes |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/appointments/services` | List active services |
| `GET` | `/appointments/services/:slug` | Get service details with staff |
| `GET` | `/appointments/availability` | Get available time slots |
| `POST` | `/appointments/book` | Book an appointment |
| `GET` | `/appointments/:id` | Get appointment details |
| `POST` | `/appointments/:id/cancel` | Cancel an appointment |

### Availability Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `serviceId` | `string` | Yes | Service to check availability for |
| `staffId` | `string` | No | Filter to a specific staff member |
| `date` | `Date` | Yes | Date to check (ISO 8601) |

## Admin Endpoints

### Services

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/appointments/services` | List all services |
| `POST` | `/admin/appointments/services/create` | Create a service |
| `GET` | `/admin/appointments/services/:id` | Get service with staff |
| `POST` | `/admin/appointments/services/:id/update` | Update a service |
| `POST` | `/admin/appointments/services/:id/delete` | Delete a service |

### Staff

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/appointments/staff` | List all staff |
| `POST` | `/admin/appointments/staff/create` | Create a staff member |
| `POST` | `/admin/appointments/staff/:id/update` | Update a staff member |
| `POST` | `/admin/appointments/staff/:id/delete` | Delete a staff member |
| `POST` | `/admin/appointments/staff/:id/services/assign` | Assign service to staff |
| `POST` | `/admin/appointments/staff/:id/schedule` | Set weekly schedule |

### Appointments

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/appointments` | List appointments (filterable) |
| `GET` | `/admin/appointments/:id` | Get appointment details |
| `POST` | `/admin/appointments/:id/update` | Update appointment |
| `GET` | `/admin/appointments/stats` | Get appointment statistics |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/appointments` | `AppointmentList` | Appointment list with status filters and management |
| `/admin/appointments/:id` | `AppointmentDetail` | Appointment detail with status updates |
| `/admin/appointments/services` | `ServiceList` | Service list with create/edit forms |
| `/admin/appointments/staff` | `StaffList` | Staff list with schedule and service assignment management |

## Controller API

```ts
interface AppointmentController {
  // Services
  createService(params): Promise<Service>;
  getService(id): Promise<Service | null>;
  getServiceBySlug(slug): Promise<Service | null>;
  updateService(id, params): Promise<Service | null>;
  deleteService(id): Promise<boolean>;
  listServices(params?): Promise<Service[]>;
  countServices(params?): Promise<number>;

  // Staff
  createStaff(params): Promise<Staff>;
  getStaff(id): Promise<Staff | null>;
  updateStaff(id, params): Promise<Staff | null>;
  deleteStaff(id): Promise<boolean>;
  listStaff(params?): Promise<Staff[]>;
  countStaff(params?): Promise<number>;

  // Staff-Service assignments
  assignService(staffId, serviceId): Promise<StaffService>;
  unassignService(staffId, serviceId): Promise<boolean>;
  getStaffServices(staffId): Promise<Service[]>;
  getServiceStaff(serviceId): Promise<Staff[]>;

  // Schedules
  setSchedule(params): Promise<Schedule>;
  getSchedule(staffId): Promise<Schedule[]>;
  removeSchedule(staffId, dayOfWeek): Promise<boolean>;

  // Availability
  getAvailableSlots(params): Promise<TimeSlot[]>;

  // Appointments
  createAppointment(params): Promise<Appointment>;
  getAppointment(id): Promise<Appointment | null>;
  updateAppointment(id, params): Promise<Appointment | null>;
  cancelAppointment(id): Promise<Appointment | null>;
  listAppointments(params?): Promise<Appointment[]>;
  countAppointments(params?): Promise<number>;
  getUpcomingAppointments(params?): Promise<Appointment[]>;

  // Stats
  getStats(): Promise<AppointmentStats>;
}
```

## Types

```ts
type ServiceStatus = "active" | "inactive";
type StaffStatus = "active" | "inactive";
type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no-show";

interface Service {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: number;       // in minutes
  price: number;
  currency: string;
  status: ServiceStatus;
  maxCapacity: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Staff {
  id: string;
  name: string;
  email: string;
  bio?: string;
  status: StaffStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface Schedule {
  id: string;
  staffId: string;
  dayOfWeek: number;     // 0 = Sunday, 6 = Saturday
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM"
  createdAt: Date;
}

interface Appointment {
  id: string;
  serviceId: string;
  staffId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  startsAt: Date;
  endsAt: Date;           // auto-calculated from service duration
  status: AppointmentStatus;
  notes?: string;
  price: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
  staffId: string;
}

interface AppointmentStats {
  totalAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  completedAppointments: number;
  noShowAppointments: number;
  totalServices: number;
  totalStaff: number;
  totalRevenue: number;
}
```

## Notes

- Schedule is per-staff, per-day — one entry per `(staffId, dayOfWeek)` pair, upserted on set.
- Availability auto-generates time slots from schedule minus existing non-cancelled appointments.
- `endsAt` is always calculated from `startsAt + service.duration` — never set directly.
- Deleting a staff member cascades to their assignments and schedules.
- Deleting a service cascades to staff-service assignments.
- Revenue stats only count completed appointments.
