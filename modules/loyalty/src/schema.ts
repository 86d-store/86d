import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const loyaltyLoyaltyAccountShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().register(col, { unique: true }),
	balance: z.int().default(0),
	lifetimeEarned: z.int().default(0),
	lifetimeRedeemed: z.int().default(0),
	tier: z.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),
	status: z.enum(["active", "suspended", "closed"]).default("active"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const loyaltyLoyaltyTransactionShape = z.object({
	id: z.string().register(col, { pk: true }),
	accountId: z.string().register(col, {
		references: {
			table: "self.loyaltyAccount",
			column: "id",
			onDelete: "cascade",
		},
	}),
	type: z.enum(["earn", "redeem", "adjust", "expire"]),
	points: z.number(),
	description: z.string(),
	orderId: z.string().optional(),
	ledgerKey: z.string().register(col, { unique: true }).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const loyaltyLoyaltyRuleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	type: z.enum(["per_dollar", "fixed_bonus", "multiplier", "signup"]),
	points: z.number(),
	minOrderAmount: z.number().optional(),
	active: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const loyaltyLoyaltyTierShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	minPoints: z.number(),
	multiplier: z.int().default(1),
	perks: z.record(z.string(), z.unknown()).optional(),
	sortOrder: z.int().default(0),
});

/** Native Relational storage for loyalty. */
export const loyaltyStorage = {
	kind: "relational",
	tables: {
		loyaltyAccount: {
			shape: loyaltyLoyaltyAccountShape,
		},
		loyaltyTransaction: {
			shape: loyaltyLoyaltyTransactionShape,
		},
		loyaltyRule: {
			shape: loyaltyLoyaltyRuleShape,
		},
		loyaltyTier: {
			shape: loyaltyLoyaltyTierShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
