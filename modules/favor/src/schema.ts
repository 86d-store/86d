import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const favorDeliveryShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	externalId: z.string().optional(),
	status: z.string(),
	pickupAddress: z.record(z.string(), z.unknown()),
	dropoffAddress: z.record(z.string(), z.unknown()),
	estimatedArrival: z.coerce.date().optional(),
	actualArrival: z.coerce.date().optional(),
	fee: z.number(),
	tip: z.number(),
	runnerName: z.string().optional(),
	runnerPhone: z.string().optional(),
	trackingUrl: z.string().optional(),
	specialInstructions: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const favorServiceAreaShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	isActive: z.boolean(),
	zipCodes: z.record(z.string(), z.unknown()),
	minOrderAmount: z.number(),
	deliveryFee: z.number(),
	estimatedMinutes: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for favor. */
export const favorStorage = {
	kind: "relational",
	tables: {
		delivery: {
			shape: favorDeliveryShape,
		},
		serviceArea: {
			shape: favorServiceAreaShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
