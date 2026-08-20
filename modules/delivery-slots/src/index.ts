import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { deliverySlotsStorage } from "./schema";
import { createDeliverySlotsController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface DeliverySlotsOptions extends ModuleConfig {
	/** Number of days into the future to show available slots. Default: 14. */
	horizonDays?: number;
}

export default function deliverySlots(options?: DeliverySlotsOptions): Module {
	return {
		id: "delivery-slots",
		version: "0.0.1",
		storage: deliverySlotsStorage,

		requires: ["orders"],

		exports: {
			read: [
				"availableSlots",
				"orderBooking",
				"slotBookingCount",
				"blackoutDates",
			],
		},

		events: {
			emits: [
				"delivery-slots.schedule.created",
				"delivery-slots.schedule.updated",
				"delivery-slots.schedule.deleted",
				"delivery-slots.booking.created",
				"delivery-slots.booking.cancelled",
				"delivery-slots.blackout.created",
				"delivery-slots.blackout.deleted",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createDeliverySlotsController(ctx.data);
			return {
				controllers: { deliverySlots: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/delivery-slots",
					component: "ScheduleList",
					label: "Delivery Slots",
					icon: "Clock",
					group: "Fulfillment",
				},
				{
					path: "/admin/delivery-slots/:id",
					component: "ScheduleDetail",
				},
				{
					path: "/admin/delivery-slots/blackouts",
					component: "BlackoutList",
					label: "Blackout Dates",
					icon: "CalendarOff",
					group: "Fulfillment",
				},
				{
					path: "/admin/delivery-slots/bookings",
					component: "BookingList",
					label: "Bookings",
					icon: "CalendarCheck",
					group: "Fulfillment",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/delivery-slots",
					component: "SlotPicker",
				},
			],
		},

		options,
	};
}

export type {
	AvailableSlotsParams,
	BookingStatus,
	BookSlotParams,
	CreateBlackoutParams,
	CreateScheduleParams,
	DeliveryBlackout,
	DeliveryBooking,
	DeliverySchedule,
	DeliverySlotsController,
	DeliverySlotsSummary,
	ListBookingsParams,
	ListSchedulesParams,
	SlotAvailability,
	UpdateScheduleParams,
} from "./service";
