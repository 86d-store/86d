import type { ModuleSchema } from "@86d-app/core/types/schema";

export const backordersSchema = {
	backorder: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			variantId: { type: "string", required: false },
			variantLabel: { type: "string", required: false },
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: true },
			orderId: { type: "string", required: false },
			quantity: { type: "number", required: true },
			status: { type: "string", required: true },
			estimatedAvailableAt: { type: "date", required: false },
			allocatedAt: { type: "date", required: false },
			shippedAt: { type: "date", required: false },
			cancelledAt: { type: "date", required: false },
			cancelReason: { type: "string", required: false },
			notes: { type: "string", required: false },
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
	backorderPolicy: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			enabled: { type: "boolean", required: true },
			maxQuantityPerOrder: { type: "number", required: false },
			maxTotalBackorders: { type: "number", required: false },
			estimatedLeadDays: { type: "number", required: false },
			autoConfirm: { type: "boolean", required: true },
			message: { type: "string", required: false },
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
