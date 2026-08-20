import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const uberEatsUberOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	externalOrderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.number(),
	deliveryFee: z.number(),
	tax: z.number(),
	total: z.number(),
	customerName: z.string().optional(),
	customerPhone: z.string().optional(),
	estimatedReadyTime: z.coerce.date().optional(),
	specialInstructions: z.string().optional(),
	orderType: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const uberEatsMenuSyncShape = z.object({
	id: z.string().register(col, { pk: true }),
	status: z.string().default("pending"),
	itemCount: z.int().default(0),
	error: z.string().optional(),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for uber-eats. */
export const uberEatsStorage = {
	kind: "relational",
	tables: {
		uberOrder: {
			shape: uberEatsUberOrderShape,
		},
		menuSync: {
			shape: uberEatsMenuSyncShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
