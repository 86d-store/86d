import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const abandonedCartsAbandonedCartShape = z.object({
	id: z.string().register(col, { pk: true }),
	cartId: z.string(),
	customerId: z.string().optional(),
	email: z.string().optional(),
	items: z.array(z.unknown()).default([]),
	cartTotal: z.number(),
	currency: z.string().default("USD"),
	status: z.string().default("active"),
	recoveryToken: z.string(),
	attemptCount: z.int().default(0),
	lastActivityAt: z.coerce.date().default(() => new Date()),
	abandonedAt: z.coerce.date().default(() => new Date()),
	recoveredAt: z.coerce.date().optional(),
	recoveredOrderId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const abandonedCartsRecoveryAttemptShape = z.object({
	id: z.string().register(col, { pk: true }),
	abandonedCartId: z.string(),
	channel: z.string(),
	recipient: z.string(),
	status: z.string().default("sent"),
	subject: z.string().optional(),
	openedAt: z.coerce.date().optional(),
	clickedAt: z.coerce.date().optional(),
	sentAt: z.coerce.date().default(() => new Date()),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for abandoned-carts. */
export const abandonedCartsStorage = {
	kind: "relational",
	tables: {
		abandonedCart: {
			shape: abandonedCartsAbandonedCartShape,
		},
		recoveryAttempt: {
			shape: abandonedCartsRecoveryAttemptShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
