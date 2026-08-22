import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const membershipsMembershipPlanShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	price: z.number(),
	billingInterval: z.string(),
	trialDays: z.number(),
	features: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean(),
	maxMembers: z.number().optional(),
	sortOrder: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const membershipsMembershipShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().register(col, { index: true }),
	planId: z.string().register(col, { index: true }),
	status: z.string(),
	startDate: z.coerce.date(),
	endDate: z.coerce.date().optional(),
	trialEndDate: z.coerce.date().optional(),
	cancelledAt: z.coerce.date().optional(),
	pausedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const membershipsMembershipBenefitShape = z.object({
	id: z.string().register(col, { pk: true }),
	planId: z.string().register(col, { index: true }),
	type: z.string(),
	value: z.string(),
	description: z.string().optional(),
	isActive: z.boolean(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const membershipsMembershipProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	planId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	assignedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for memberships. */
export const membershipsStorage = {
	kind: "relational",
	tables: {
		membershipPlan: {
			shape: membershipsMembershipPlanShape,
		},
		membership: {
			shape: membershipsMembershipShape,
		},
		membershipBenefit: {
			shape: membershipsMembershipBenefitShape,
		},
		membershipProduct: {
			shape: membershipsMembershipProductShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
