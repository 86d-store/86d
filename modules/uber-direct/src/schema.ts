import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const uberDirectDeliveryShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	externalId: z.string().optional(),
	status: z.string(),
	pickupAddress: z.record(z.string(), z.unknown()),
	dropoffAddress: z.record(z.string(), z.unknown()),
	pickupNotes: z.string().optional(),
	dropoffNotes: z.string().optional(),
	estimatedPickupTime: z.coerce.date().optional(),
	estimatedDeliveryTime: z.coerce.date().optional(),
	actualPickupTime: z.coerce.date().optional(),
	actualDeliveryTime: z.coerce.date().optional(),
	fee: z.number(),
	tip: z.number(),
	trackingUrl: z.string().optional(),
	courierName: z.string().optional(),
	courierPhone: z.string().optional(),
	courierVehicle: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const uberDirectQuoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	pickupAddress: z.record(z.string(), z.unknown()),
	dropoffAddress: z.record(z.string(), z.unknown()),
	fee: z.number(),
	estimatedMinutes: z.number(),
	expiresAt: z.coerce.date().default(() => new Date()),
	status: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const uberDirectServiceAreaShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	isActive: z.boolean().default(true),
	radius: z.number(),
	centerLat: z.number(),
	centerLng: z.number(),
	deliveryFee: z.number(),
	estimatedMinutes: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for uber-direct. */
export const uberDirectStorage = {
	kind: "relational",
	tables: {
		delivery: {
			shape: uberDirectDeliveryShape,
		},
		quote: {
			shape: uberDirectQuoteShape,
		},
		serviceArea: {
			shape: uberDirectServiceAreaShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
