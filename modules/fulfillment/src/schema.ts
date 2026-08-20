import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const fulfillmentFulfillmentOrderLockShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, { unique: true }),
});

export const fulfillmentFulfillmentShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	carrier: z.string().optional(),
	trackingNumber: z.string().optional(),
	trackingUrl: z.string().optional(),
	notes: z.string().optional(),
	shippedAt: z.coerce.date().optional(),
	deliveredAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for fulfillment. */
export const fulfillmentStorage = {
	kind: "relational",
	tables: {
		fulfillmentOrderLock: {
			shape: fulfillmentFulfillmentOrderLockShape,
		},
		fulfillment: {
			shape: fulfillmentFulfillmentShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
