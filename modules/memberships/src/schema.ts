import type { ModuleSchema } from "@86d-app/core/types/schema";

export const membershipsSchema = {
	membershipPlan: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			price: { type: "number", required: true },
			billingInterval: { type: "string", required: true },
			trialDays: { type: "number", required: true },
			features: { type: "json", required: false },
			isActive: { type: "boolean", required: true },
			maxMembers: { type: "number", required: false },
			sortOrder: { type: "number", required: true },
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
	membership: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true, index: true },
			planId: { type: "string", required: true, index: true },
			status: { type: "string", required: true },
			startDate: { type: "date", required: true },
			endDate: { type: "date", required: false },
			trialEndDate: { type: "date", required: false },
			cancelledAt: { type: "date", required: false },
			pausedAt: { type: "date", required: false },
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
	membershipBenefit: {
		fields: {
			id: { type: "string", required: true },
			planId: { type: "string", required: true, index: true },
			type: { type: "string", required: true },
			value: { type: "string", required: true },
			description: { type: "string", required: false },
			isActive: { type: "boolean", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	membershipProduct: {
		fields: {
			id: { type: "string", required: true },
			planId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			assignedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
