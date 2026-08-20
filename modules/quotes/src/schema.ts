import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const quotesQuoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	customerEmail: z.string(),
	customerName: z.string(),
	companyName: z.string().optional(),
	status: z
		.enum([
			"draft",
			"submitted",
			"under_review",
			"countered",
			"accepted",
			"rejected",
			"expired",
			"converted",
		])
		.default("draft"),
	notes: z.string().optional(),
	adminNotes: z.string().optional(),
	subtotal: z.int().default(0),
	discount: z.int().default(0),
	total: z.int().default(0),
	expiresAt: z.coerce.date().optional(),
	convertedOrderId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const quotesQuoteItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	quoteId: z.string().register(col, {
		references: { table: "self.quote", column: "id", onDelete: "cascade" },
	}),
	productId: z.string(),
	productName: z.string(),
	sku: z.string().optional(),
	quantity: z.int().default(1),
	unitPrice: z.number(),
	offeredPrice: z.number().optional(),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const quotesQuoteCommentShape = z.object({
	id: z.string().register(col, { pk: true }),
	quoteId: z.string().register(col, {
		references: { table: "self.quote", column: "id", onDelete: "cascade" },
	}),
	authorType: z.enum(["customer", "admin"]),
	authorId: z.string(),
	authorName: z.string(),
	message: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const quotesQuoteHistoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	quoteId: z.string().register(col, {
		references: { table: "self.quote", column: "id", onDelete: "cascade" },
	}),
	fromStatus: z.string(),
	toStatus: z.string(),
	changedBy: z.string(),
	reason: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for quotes. */
export const quotesStorage = {
	kind: "relational",
	tables: {
		quote: {
			shape: quotesQuoteShape,
		},
		quoteItem: {
			shape: quotesQuoteItemShape,
		},
		quoteComment: {
			shape: quotesQuoteCommentShape,
		},
		quoteHistory: {
			shape: quotesQuoteHistoryShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
