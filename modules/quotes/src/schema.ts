import type { ModuleSchema } from "@86d-app/core/types/schema";

export const quoteSchema = {
	quote: {
		fields: {
			id: { type: "string", required: true },
			customerId: { type: "string", required: true },
			customerEmail: { type: "string", required: true },
			customerName: { type: "string", required: true },
			companyName: { type: "string", required: false },
			status: {
				type: [
					"draft",
					"submitted",
					"under_review",
					"countered",
					"accepted",
					"rejected",
					"expired",
					"converted",
				] as const,
				required: true,
				defaultValue: "draft",
			},
			notes: { type: "string", required: false },
			adminNotes: { type: "string", required: false },
			subtotal: { type: "number", required: true, defaultValue: 0 },
			discount: { type: "number", required: true, defaultValue: 0 },
			total: { type: "number", required: true, defaultValue: 0 },
			expiresAt: { type: "date", required: false },
			convertedOrderId: { type: "string", required: false },
			metadata: { type: "json", required: false, defaultValue: {} },
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
	quoteItem: {
		fields: {
			id: { type: "string", required: true },
			quoteId: {
				type: "string",
				required: true,
				references: { model: "quote", field: "id", onDelete: "cascade" },
			},
			productId: { type: "string", required: true },
			productName: { type: "string", required: true },
			sku: { type: "string", required: false },
			quantity: { type: "number", required: true, defaultValue: 1 },
			unitPrice: { type: "number", required: true },
			offeredPrice: { type: "number", required: false },
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
				onUpdate: () => new Date(),
			},
		},
	},
	quoteComment: {
		fields: {
			id: { type: "string", required: true },
			quoteId: {
				type: "string",
				required: true,
				references: { model: "quote", field: "id", onDelete: "cascade" },
			},
			authorType: { type: ["customer", "admin"] as const, required: true },
			authorId: { type: "string", required: true },
			authorName: { type: "string", required: true },
			message: { type: "string", required: true },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	quoteHistory: {
		fields: {
			id: { type: "string", required: true },
			quoteId: {
				type: "string",
				required: true,
				references: { model: "quote", field: "id", onDelete: "cascade" },
			},
			fromStatus: { type: "string", required: true },
			toStatus: { type: "string", required: true },
			changedBy: { type: "string", required: true },
			reason: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
