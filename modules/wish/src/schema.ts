import type { ModuleSchema } from "@86d-app/core/types/schema";

export const wishSchema = {
	wishProduct: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			wishProductId: { type: "string", required: false },
			title: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "active" },
			price: { type: "number", required: true },
			shippingPrice: { type: "number", required: true },
			quantity: { type: "number", required: true, defaultValue: 0 },
			parentSku: { type: "string", required: false },
			tags: { type: "json", required: true, defaultValue: [] },
			lastSyncedAt: { type: "date", required: false },
			reviewStatus: { type: "string", required: false },
			error: { type: "string", required: false },
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
	wishOrder: {
		fields: {
			id: { type: "string", required: true },
			wishOrderId: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			items: { type: "json", required: true, defaultValue: [] },
			orderTotal: { type: "number", required: true },
			shippingTotal: { type: "number", required: true },
			wishFee: { type: "number", required: true },
			customerName: { type: "string", required: false },
			shippingAddress: { type: "json", required: true, defaultValue: {} },
			trackingNumber: { type: "string", required: false },
			carrier: { type: "string", required: false },
			shipByDate: { type: "date", required: false },
			deliverByDate: { type: "date", required: false },
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
