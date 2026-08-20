import type { ModuleSchema } from "@86d-app/core/types/schema";

export const socialProofSchema = {
	activityEvent: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			productSlug: { type: "string", required: true },
			productImage: { type: "string", required: false },
			eventType: { type: "string", required: true },
			region: { type: "string", required: false },
			country: { type: "string", required: false },
			city: { type: "string", required: false },
			quantity: { type: "number", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	trustBadge: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			icon: { type: "string", required: true },
			url: { type: "string", required: false },
			position: { type: "string", required: true },
			priority: { type: "number", required: true },
			isActive: { type: "boolean", required: true },
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
} satisfies ModuleSchema;
