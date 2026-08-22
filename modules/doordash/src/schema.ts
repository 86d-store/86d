import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const doordashDeliveryShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	externalDeliveryId: z.string().optional(),
	status: z.string().default("pending"),
	pickupAddress: z.record(z.string(), z.unknown()).default({}),
	dropoffAddress: z.record(z.string(), z.unknown()).default({}),
	estimatedPickupTime: z.coerce.date().optional(),
	estimatedDeliveryTime: z.coerce.date().optional(),
	actualPickupTime: z.coerce.date().optional(),
	actualDeliveryTime: z.coerce.date().optional(),
	fee: z.number(),
	tip: z.int().default(0),
	trackingUrl: z.string().optional(),
	driverName: z.string().optional(),
	driverPhone: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const doordashQuoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	externalDeliveryId: z.string(),
	fee: z.number(),
	currency: z.string().default("USD"),
	estimatedPickupTime: z.string().optional(),
	estimatedDropoffTime: z.string().optional(),
	expiresAt: z.coerce.date().default(() => new Date()),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const doordashDeliveryZoneShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	isActive: z.boolean().default(true),
	radius: z.number(),
	centerLat: z.number(),
	centerLng: z.number(),
	minOrderAmount: z.int().default(0),
	deliveryFee: z.number(),
	estimatedMinutes: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for doordash. */
export const doordashStorage = {
	kind: "relational",
	tables: {
		delivery: {
			shape: doordashDeliveryShape,
		},
		quote: {
			shape: doordashQuoteShape,
		},
		deliveryZone: {
			shape: doordashDeliveryZoneShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
