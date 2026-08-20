import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const subscriptionsSubscriptionPlanShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	price: z.number(),
	currency: z.string().default("USD"),
	interval: z.string(),
	intervalCount: z.int().default(1),
	trialDays: z.number().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const subscriptionsSubscriptionShape = z.object({
	id: z.string().register(col, { pk: true }),
	planId: z.string(),
	customerId: z.string().optional(),
	email: z.string(),
	status: z.string().default("active"),
	currentPeriodStart: z.coerce.date(),
	currentPeriodEnd: z.coerce.date(),
	trialStart: z.coerce.date().optional(),
	trialEnd: z.coerce.date().optional(),
	cancelledAt: z.coerce.date().optional(),
	cancelAtPeriodEnd: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for subscriptions. */
export const subscriptionsStorage = {
	kind: "relational",
	tables: {
		subscriptionPlan: {
			shape: subscriptionsSubscriptionPlanShape,
		},
		subscription: {
			shape: subscriptionsSubscriptionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
