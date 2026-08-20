import type { ModuleSchema } from "@86d-app/core/types/schema";

export const tippingSchema = {
	tip: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			amount: { type: "number", required: true },
			percentage: { type: "number", required: false },
			/** preset | custom */
			type: { type: "string", required: true },
			/** driver | server | staff | store */
			recipientType: { type: "string", required: true },
			recipientId: { type: "string", required: false },
			customerId: { type: "string", required: false },
			/** pending | paid | refunded */
			status: { type: "string", required: true },
			paidAt: { type: "date", required: false },
			metadata: { type: "json", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	tipPayout: {
		fields: {
			id: { type: "string", required: true },
			recipientId: { type: "string", required: true },
			recipientType: { type: "string", required: true },
			amount: { type: "number", required: true },
			tipCount: { type: "number", required: true },
			periodStart: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			periodEnd: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			/** pending | processing | paid | failed */
			status: { type: "string", required: true },
			paidAt: { type: "date", required: false },
			reference: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	tipSettings: {
		fields: {
			id: { type: "string", required: true },
			presetPercents: { type: "json", required: true },
			allowCustom: { type: "boolean", required: true },
			maxPercent: { type: "number", required: true },
			maxAmount: { type: "number", required: true },
			enableSplitting: { type: "boolean", required: true },
			defaultRecipientType: { type: "string", required: true },
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
