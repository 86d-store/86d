import type { ModuleSchema } from "@86d-app/core/types/schema";

export const deliverySlotsSchema = {
	deliverySchedule: {
		fields: {
			id: { type: "string", required: true },
			/** Display name (e.g. "Weekday Morning") */
			name: { type: "string", required: true },
			/** Day of week: 0 = Sunday … 6 = Saturday */
			dayOfWeek: { type: "number", required: true },
			/** Start time in HH:MM 24-hour format */
			startTime: { type: "string", required: true },
			/** End time in HH:MM 24-hour format */
			endTime: { type: "string", required: true },
			/** Maximum bookings allowed per slot occurrence */
			capacity: { type: "number", required: true },
			/** Surcharge in cents for this slot (0 = no surcharge) */
			surchargeInCents: { type: "number", required: true, defaultValue: 0 },
			/** Whether customers can book this slot */
			active: { type: "boolean", required: true, defaultValue: true },
			/** Display order within the same day */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	deliveryBooking: {
		fields: {
			id: { type: "string", required: true },
			/** The schedule this booking is for */
			scheduleId: {
				type: "string",
				required: true,
				references: {
					model: "deliverySchedule",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			/** The specific delivery date (YYYY-MM-DD) */
			deliveryDate: { type: "string", required: true, index: true },
			/** Associated order ID */
			orderId: { type: "string", required: true, index: true },
			/** Customer who booked */
			customerId: { type: "string", required: false, index: true },
			/** Denormalized schedule name */
			scheduleName: { type: "string", required: true },
			/** Denormalized time window */
			startTime: { type: "string", required: true },
			endTime: { type: "string", required: true },
			/** Surcharge charged in cents (snapshot) */
			surchargeInCents: { type: "number", required: true },
			/** Booking status */
			status: {
				type: ["confirmed", "cancelled"] as const,
				required: true,
			},
			/** Optional delivery instructions */
			instructions: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	deliveryBlackout: {
		fields: {
			id: { type: "string", required: true },
			/** Date to block (YYYY-MM-DD) */
			date: { type: "string", required: true, index: true },
			/** Reason displayed to customers */
			reason: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
