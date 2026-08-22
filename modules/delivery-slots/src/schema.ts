import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const deliverySlotsDeliveryScheduleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	dayOfWeek: z.number(),
	startTime: z.string(),
	endTime: z.string(),
	capacity: z.number(),
	surchargeInCents: z.int().default(0),
	active: z.boolean().default(true),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const deliverySlotsDeliveryBookingShape = z.object({
	id: z.string().register(col, { pk: true }),
	scheduleId: z.string().register(col, {
		references: {
			table: "self.deliverySchedule",
			column: "id",
			onDelete: "cascade",
		},
	}),
	deliveryDate: z.string().register(col, { index: true }),
	orderId: z.string().register(col, { index: true }),
	customerId: z.string().register(col, { index: true }).optional(),
	scheduleName: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	surchargeInCents: z.number(),
	status: z.enum(["confirmed", "cancelled"]),
	instructions: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const deliverySlotsDeliveryBlackoutShape = z.object({
	id: z.string().register(col, { pk: true }),
	date: z.string().register(col, { index: true }),
	reason: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for delivery-slots. */
export const deliverySlotsStorage = {
	kind: "relational",
	tables: {
		deliverySchedule: {
			shape: deliverySlotsDeliveryScheduleShape,
		},
		deliveryBooking: {
			shape: deliverySlotsDeliveryBookingShape,
		},
		deliveryBlackout: {
			shape: deliverySlotsDeliveryBlackoutShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
