import type { ModuleSchema } from "@86d-app/core/types/schema";

export const tiktokShopSchema = {
	listing: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			externalProductId: { type: "string", required: false },
			title: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "draft" },
			syncStatus: { type: "string", required: true, defaultValue: "pending" },
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
	channelOrder: {
		fields: {
			id: { type: "string", required: true },
			externalOrderId: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			items: { type: "json", required: true, defaultValue: [] },
			subtotal: { type: "number", required: true, defaultValue: 0 },
			shippingFee: { type: "number", required: true, defaultValue: 0 },
			platformFee: { type: "number", required: true, defaultValue: 0 },
			total: { type: "number", required: true, defaultValue: 0 },
			customerName: { type: "string", required: false },
			shippingAddress: { type: "json", required: true, defaultValue: {} },
			trackingNumber: { type: "string", required: false },
			trackingUrl: { type: "string", required: false },
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
	catalogSync: {
		fields: {
			id: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			totalProducts: { type: "number", required: true, defaultValue: 0 },
			syncedProducts: { type: "number", required: true, defaultValue: 0 },
			failedProducts: { type: "number", required: true, defaultValue: 0 },
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
