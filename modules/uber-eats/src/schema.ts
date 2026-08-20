import type { ModuleSchema } from "@86d-app/core/types/schema";

export const uberEatsSchema = {
	uberOrder: {
		fields: {
			id: { type: "string", required: true },
			externalOrderId: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			items: { type: "json", required: true, defaultValue: [] },
			subtotal: { type: "number", required: true },
			deliveryFee: { type: "number", required: true },
			tax: { type: "number", required: true },
			total: { type: "number", required: true },
			customerName: { type: "string", required: false },
			customerPhone: { type: "string", required: false },
			estimatedReadyTime: { type: "date", required: false },
			specialInstructions: { type: "string", required: false },
			orderType: { type: "string", required: false },
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
	menuSync: {
		fields: {
			id: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			itemCount: { type: "number", required: true, defaultValue: 0 },
			error: { type: "string", required: false },
			startedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			completedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
