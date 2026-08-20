import type { ModuleSchema } from "@86d-app/core/types/schema";

export const storeCreditsSchema = {
	creditAccount: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			customerId: {
				type: "string",
				required: true,
				unique: true,
			},
			customerEmail: {
				type: "string",
				required: false,
			},
			balance: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			lifetimeCredited: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			lifetimeDebited: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			currency: {
				type: "string",
				required: true,
				defaultValue: "USD",
			},
			status: {
				type: ["active", "frozen", "closed"] as const,
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
	creditTransaction: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			accountId: {
				type: "string",
				required: true,
				references: {
					model: "creditAccount",
					field: "id",
					onDelete: "cascade" as const,
				},
			},
			type: {
				type: ["credit", "debit"] as const,
				required: true,
			},
			amount: {
				type: "number",
				required: true,
			},
			balanceAfter: {
				type: "number",
				required: true,
			},
			reason: {
				type: [
					"return_refund",
					"order_payment",
					"admin_adjustment",
					"referral_reward",
					"gift_card_conversion",
					"promotional",
					"other",
				] as const,
				required: true,
			},
			description: {
				type: "string",
				required: true,
			},
			referenceType: {
				type: "string",
				required: false,
			},
			referenceId: {
				type: "string",
				required: false,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
