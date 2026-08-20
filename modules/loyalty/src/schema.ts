import type { ModuleSchema } from "@86d-app/core/types/schema";

export const loyaltySchema = {
	loyaltyAccount: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true, unique: true },
			balance: { type: "number", required: true, defaultValue: 0 },
			lifetimeEarned: { type: "number", required: true, defaultValue: 0 },
			lifetimeRedeemed: { type: "number", required: true, defaultValue: 0 },
			tier: {
				type: ["bronze", "silver", "gold", "platinum"] as const,
				required: true,
				defaultValue: "bronze",
			},
			status: {
				type: ["active", "suspended", "closed"] as const,
				required: true,
				defaultValue: "active",
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	loyaltyTransaction: {
		fields: {
			id: { type: "string", required: true },
			accountId: {
				type: "string",
				required: true,
				references: {
					model: "loyaltyAccount",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			type: {
				type: ["earn", "redeem", "adjust", "expire"] as const,
				required: true,
			},
			points: { type: "number", required: true },
			description: { type: "string", required: true },
			orderId: { type: "string", required: false },
			ledgerKey: { type: "string", required: false, unique: true },
			metadata: { type: "json", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	loyaltyRule: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			type: {
				type: ["per_dollar", "fixed_bonus", "multiplier", "signup"] as const,
				required: true,
			},
			points: { type: "number", required: true },
			minOrderAmount: { type: "number", required: false },
			active: { type: "boolean", required: true, defaultValue: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	loyaltyTier: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			minPoints: { type: "number", required: true },
			multiplier: { type: "number", required: true, defaultValue: 1 },
			perks: { type: "json", required: false },
			sortOrder: { type: "number", required: true, defaultValue: 0 },
		},
	},
} satisfies ModuleSchema;
