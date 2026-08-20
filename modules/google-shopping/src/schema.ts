import type { ModuleSchema } from "@86d-app/core/types/schema";

export const googleShoppingSchema = {
	productFeed: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			googleProductId: { type: "string", required: false },
			title: { type: "string", required: true },
			description: { type: "string", required: false },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			disapprovalReasons: {
				type: "json",
				required: true,
				defaultValue: [],
			},
			googleCategory: { type: "string", required: false },
			condition: { type: "string", required: true, defaultValue: "new" },
			availability: {
				type: "string",
				required: true,
				defaultValue: "in-stock",
			},
			price: { type: "number", required: true },
			salePrice: { type: "number", required: false },
			link: { type: "string", required: true },
			imageLink: { type: "string", required: true },
			gtin: { type: "string", required: false },
			mpn: { type: "string", required: false },
			brand: { type: "string", required: false },
			lastSyncedAt: { type: "date", required: false },
			expiresAt: { type: "date", required: false },
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
			googleOrderId: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			items: { type: "json", required: true, defaultValue: [] },
			subtotal: { type: "number", required: true },
			shippingCost: { type: "number", required: true },
			tax: { type: "number", required: true },
			total: { type: "number", required: true },
			shippingAddress: {
				type: "json",
				required: true,
				defaultValue: {},
			},
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
	feedSubmission: {
		fields: {
			id: { type: "string", required: true },
			status: {
				type: "string",
				required: true,
				defaultValue: "pending",
			},
			totalProducts: { type: "number", required: true, defaultValue: 0 },
			approvedProducts: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			disapprovedProducts: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			error: { type: "string", required: false },
			submittedAt: {
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
