import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const storePickupPickupLocationShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	address: z.string(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	phone: z.string().optional(),
	email: z.string().optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	preparationMinutes: z.int().default(60),
	active: z.boolean().default(true),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const storePickupPickupWindowShape = z.object({
	id: z.string().register(col, { pk: true }),
	locationId: z.string().register(col, {
		references: {
			table: "self.pickupLocation",
			column: "id",
			onDelete: "cascade",
		},
	}),
	dayOfWeek: z.number(),
	startTime: z.string(),
	endTime: z.string(),
	capacity: z.number(),
	active: z.boolean().default(true),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const storePickupPickupOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	locationId: z.string().register(col, {
		references: {
			table: "self.pickupLocation",
			column: "id",
			onDelete: "cascade",
		},
	}),
	windowId: z.string().register(col, {
		references: {
			table: "self.pickupWindow",
			column: "id",
			onDelete: "cascade",
		},
	}),
	orderId: z.string().register(col, { index: true }),
	customerId: z.string().register(col, { index: true }).optional(),
	scheduledDate: z.string().register(col, { index: true }),
	locationName: z.string(),
	locationAddress: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	status: z.enum(["scheduled", "preparing", "ready", "picked_up", "cancelled"]),
	notes: z.string().optional(),
	preparingAt: z.coerce.date().optional(),
	readyAt: z.coerce.date().optional(),
	pickedUpAt: z.coerce.date().optional(),
	cancelledAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const storePickupPickupBlackoutShape = z.object({
	id: z.string().register(col, { pk: true }),
	locationId: z.string().register(col, {
		references: {
			table: "self.pickupLocation",
			column: "id",
			onDelete: "cascade",
		},
	}),
	date: z.string().register(col, { index: true }),
	reason: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for store-pickup. */
export const storePickupStorage = {
	kind: "relational",
	tables: {
		pickupLocation: {
			shape: storePickupPickupLocationShape,
		},
		pickupWindow: {
			shape: storePickupPickupWindowShape,
		},
		pickupOrder: {
			shape: storePickupPickupOrderShape,
		},
		pickupBlackout: {
			shape: storePickupPickupBlackoutShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
