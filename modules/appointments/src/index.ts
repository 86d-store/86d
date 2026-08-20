import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { appointmentsSchema } from "./schema";
import { createAppointmentController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Appointment,
	AppointmentController,
	AppointmentStats,
	AppointmentStatus,
	Schedule,
	Service,
	ServiceStatus,
	ServiceWithStaff,
	Staff,
	StaffService,
	StaffStatus,
	StaffWithServices,
	TimeSlot,
} from "./service";

export interface AppointmentsOptions extends ModuleConfig {
	/** Default currency for service pricing. Default: "USD". */
	defaultCurrency?: string;
	/** Minimum advance booking time in minutes. Default: no minimum. */
	minAdvanceMinutes?: number;
}

export default function appointments(options?: AppointmentsOptions): Module {
	return {
		id: "appointments",
		version: "0.0.1",
		schema: appointmentsSchema,
		exports: {
			read: [
				"availableSlots",
				"upcomingAppointments",
				"serviceList",
				"staffSchedule",
			],
		},
		events: {
			emits: [
				"appointment.created",
				"appointment.confirmed",
				"appointment.cancelled",
				"appointment.completed",
				"appointment.no-show",
				"appointment.rescheduled",
				"service.created",
				"service.updated",
				"service.deleted",
				"staff.created",
				"staff.updated",
				"staff.deleted",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createAppointmentController(ctx.data);
			return { controllers: { appointments: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/appointments",
					component: "AppointmentList",
					label: "Appointments",
					icon: "Calendar",
					group: "Sales",
				},
				{
					path: "/admin/appointments/:id",
					component: "AppointmentDetail",
				},
				{
					path: "/admin/appointments/services",
					component: "ServiceList",
					label: "Services",
					icon: "Briefcase",
					group: "Sales",
				},
				{
					path: "/admin/appointments/staff",
					component: "StaffList",
					label: "Staff",
					icon: "Users",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/appointments",
					component: "AppointmentBooking",
				},
				{
					path: "/account/appointments",
					component: "MyAppointments",
				},
				{
					path: "/account/appointments/:id",
					component: "MyAppointments",
				},
			],
		},
		options,
	};
}
