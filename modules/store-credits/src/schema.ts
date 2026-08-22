import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const storeCreditsCreditAccountShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().register(col, { unique: true }),
	customerEmail: z.string().optional(),
	balance: z.int().default(0),
	lifetimeCredited: z.int().default(0),
	lifetimeDebited: z.int().default(0),
	currency: z.string().default("USD"),
	status: z.enum(["active", "frozen", "closed"]).default("active"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const storeCreditsCreditTransactionShape = z.object({
	id: z.string().register(col, { pk: true }),
	accountId: z.string().register(col, {
		references: {
			table: "self.creditAccount",
			column: "id",
			onDelete: "cascade",
		},
	}),
	type: z.enum(["credit", "debit"]),
	amount: z.number(),
	balanceAfter: z.number(),
	reason: z.enum([
		"return_refund",
		"order_payment",
		"admin_adjustment",
		"referral_reward",
		"gift_card_conversion",
		"promotional",
		"other",
	]),
	description: z.string(),
	referenceType: z.string().optional(),
	referenceId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for store-credits. */
export const storeCreditsStorage = {
	kind: "relational",
	tables: {
		creditAccount: {
			shape: storeCreditsCreditAccountShape,
		},
		creditTransaction: {
			shape: storeCreditsCreditTransactionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
