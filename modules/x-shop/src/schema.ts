import type { ModuleSchema } from "@86d-app/core/types/schema";

export const xShopSchema = {
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
	productDrop: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			description: { type: "string", required: false },
			productIds: { type: "json", required: true, defaultValue: [] },
			launchDate: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			endDate: { type: "date", required: false },
			status: { type: "string", required: true, defaultValue: "scheduled" },
			tweetId: { type: "string", required: false },
			impressions: { type: "number", required: true, defaultValue: 0 },
			clicks: { type: "number", required: true, defaultValue: 0 },
			conversions: { type: "number", required: true, defaultValue: 0 },
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
