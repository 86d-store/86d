import type { ModuleSchema } from "@86d-app/core/types/schema";

export const amazonSchema = {
	listing: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			asin: { type: "string", required: false },
			sku: { type: "string", required: true },
			title: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "incomplete",
			},
			fulfillmentChannel: {
				type: "string",
				required: true,
				defaultValue: "FBM",
			},
			price: { type: "number", required: true },
			quantity: { type: "number", required: true, defaultValue: 0 },
			condition: {
				type: "string",
				required: true,
				defaultValue: "new",
			},
			buyBoxOwned: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			lastSyncedAt: { type: "date", required: false },
			error: { type: "string", required: false },
			metadata: { type: "json", required: true, defaultValue: {} },
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
	amazonOrder: {
		fields: {
			id: { type: "string", required: true },
			amazonOrderId: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			fulfillmentChannel: {
				type: "string",
				required: true,
				defaultValue: "FBM",
			},
			items: { type: "json", required: true, defaultValue: [] },
			orderTotal: { type: "number", required: true },
			shippingTotal: { type: "number", required: true },
			marketplaceFee: { type: "number", required: true },
			netProceeds: { type: "number", required: true },
			buyerName: { type: "string", required: false },
			shippingAddress: {
				type: "json",
				required: true,
				defaultValue: {},
			},
			shipDate: { type: "date", required: false },
			trackingNumber: { type: "string", required: false },
			carrier: { type: "string", required: false },
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
	inventorySync: {
		fields: {
			id: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			totalSkus: { type: "number", required: true, defaultValue: 0 },
			updatedSkus: { type: "number", required: true, defaultValue: 0 },
			failedSkus: { type: "number", required: true, defaultValue: 0 },
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
