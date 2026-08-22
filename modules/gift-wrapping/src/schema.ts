import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const giftWrappingWrapOptionShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	priceInCents: z.number(),
	imageUrl: z.string().optional(),
	active: z.boolean().default(true),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const giftWrappingWrapSelectionShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, { index: true }),
	orderItemId: z.string().register(col, { index: true }),
	wrapOptionId: z.string().register(col, {
		references: {
			table: "self.wrapOption",
			column: "id",
			onDelete: "cascade",
		},
	}),
	wrapOptionName: z.string(),
	priceInCents: z.number(),
	recipientName: z.string().optional(),
	giftMessage: z.string().optional(),
	customerId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for gift-wrapping. */
export const giftWrappingStorage = {
	kind: "relational",
	tables: {
		wrapOption: {
			shape: giftWrappingWrapOptionShape,
		},
		wrapSelection: {
			shape: giftWrappingWrapSelectionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
