import type { ModuleSchema } from "@86d-app/core/types/schema";

export const preordersSchema = {
	preorderCampaign: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			variantId: { type: "string", required: false },
			variantLabel: { type: "string", required: false },
			status: { type: "string", required: true },
			paymentType: { type: "string", required: true },
			depositAmount: { type: "number", required: false },
			depositPercent: { type: "number", required: false },
			price: { type: "number", required: true },
			maxQuantity: { type: "number", required: false },
			currentQuantity: { type: "number", required: true },
			startDate: { type: "date", required: true },
			endDate: { type: "date", required: false },
			estimatedShipDate: { type: "date", required: false },
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
	preorderItem: {
		fields: {
			id: { type: "string", required: true },
			campaignId: { type: "string", required: true },
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: true },
			quantity: { type: "number", required: true },
			status: { type: "string", required: true },
			depositPaid: { type: "number", required: true },
			totalPrice: { type: "number", required: true },
			orderId: { type: "string", required: false },
			notifiedAt: { type: "date", required: false },
			cancelledAt: { type: "date", required: false },
			cancelReason: { type: "string", required: false },
			fulfilledAt: { type: "date", required: false },
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
