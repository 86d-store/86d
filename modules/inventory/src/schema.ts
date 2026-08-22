import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const inventoryInventoryItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	variantId: z.string().optional(),
	locationId: z.string().optional(),
	quantity: z.int().default(0),
	reserved: z.int().default(0),
	lowStockThreshold: z.number().optional(),
	allowBackorder: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const inventoryBackInStockSubscriptionShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	variantId: z.string().optional(),
	email: z.string(),
	customerId: z.string().optional(),
	productName: z.string().optional(),
	status: z.string().default("active"),
	subscribedAt: z.coerce.date().default(() => new Date()),
	notifiedAt: z.coerce.date().optional(),
});

export const inventoryInventoryReservationShape = z.object({
	id: z.string().register(col, { pk: true }),
	checkoutId: z.string().register(col, { index: true }),
	lineId: z.string(),
	productId: z.string().register(col, { index: true }),
	variantId: z.string().optional(),
	locationId: z.string().register(col, { index: true }).optional(),
	quantity: z.number(),
	leaseExpiresAt: z.coerce.date().register(col, { index: true }),
	status: z.string().register(col, { index: true }),
	idempotencyKey: z.string(),
	committedAt: z.coerce.date().optional(),
	releasedAt: z.coerce.date().optional(),
	expiredAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const inventoryInventoryReservationOperationShape = z.object({
	id: z.string().register(col, { pk: true }),
	reservationId: z.string().register(col, { index: true }),
	idempotencyKey: z.string().register(col, { index: true }),
	operation: z.string(),
	requestSignature: z.string(),
	result: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const inventoryInventoryReservationLockShape = z.object({
	id: z.string().register(col, { pk: true }),
});

/** Native Relational storage for inventory. */
export const inventoryStorage = {
	kind: "relational",
	tables: {
		inventoryItem: {
			shape: inventoryInventoryItemShape,
		},
		backInStockSubscription: {
			shape: inventoryBackInStockSubscriptionShape,
		},
		inventoryReservation: {
			shape: inventoryInventoryReservationShape,
		},
		inventoryReservationOperation: {
			shape: inventoryInventoryReservationOperationShape,
		},
		inventoryReservationLock: {
			shape: inventoryInventoryReservationLockShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
