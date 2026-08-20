import type { ModuleSchema } from "@86d-app/core/types/schema";

export const subscriptionsSchema = {
	subscriptionPlan: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			price: { type: "number", required: true },
			currency: { type: "string", required: true, defaultValue: "USD" },
			interval: { type: "string", required: true },
			intervalCount: { type: "number", required: true, defaultValue: 1 },
			trialDays: { type: "number", required: false },
			isActive: { type: "boolean", required: true, defaultValue: true },
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
	subscription: {
		fields: {
			id: { type: "string", required: true },
			planId: { type: "string", required: true },
			customerId: { type: "string", required: false },
			email: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "active" },
			currentPeriodStart: { type: "date", required: true },
			currentPeriodEnd: { type: "date", required: true },
			trialStart: { type: "date", required: false },
			trialEnd: { type: "date", required: false },
			cancelledAt: { type: "date", required: false },
			cancelAtPeriodEnd: {
				type: "boolean",
				required: true,
				defaultValue: false,
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
} satisfies ModuleSchema;
