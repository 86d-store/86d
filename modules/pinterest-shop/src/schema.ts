import type { ModuleSchema } from "@86d-app/core/types/schema";

export const pinterestShopSchema = {
	catalogItem: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			pinterestItemId: { type: "string", required: false },
			title: { type: "string", required: true },
			description: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "active" },
			link: { type: "string", required: true },
			imageUrl: { type: "string", required: true },
			price: { type: "number", required: true },
			salePrice: { type: "number", required: false },
			availability: {
				type: "string",
				required: true,
				defaultValue: "in-stock",
			},
			googleCategory: { type: "string", required: false },
			lastSyncedAt: { type: "date", required: false },
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
	shoppingPin: {
		fields: {
			id: { type: "string", required: true },
			catalogItemId: { type: "string", required: true },
			pinId: { type: "string", required: false },
			boardId: { type: "string", required: false },
			title: { type: "string", required: true },
			description: { type: "string", required: false },
			link: { type: "string", required: true },
			imageUrl: { type: "string", required: true },
			impressions: { type: "number", required: true, defaultValue: 0 },
			saves: { type: "number", required: true, defaultValue: 0 },
			clicks: { type: "number", required: true, defaultValue: 0 },
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
			totalItems: { type: "number", required: true, defaultValue: 0 },
			syncedItems: { type: "number", required: true, defaultValue: 0 },
			failedItems: { type: "number", required: true, defaultValue: 0 },
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
