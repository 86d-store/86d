import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const priceListsPriceListShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	currency: z.string().optional(),
	priority: z.number(),
	status: z.string(),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	customerGroupId: z.string().register(col, { index: true }).optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const priceListsPriceEntryShape = z.object({
	id: z.string().register(col, { pk: true }),
	priceListId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	price: z.number(),
	compareAtPrice: z.number().optional(),
	minQuantity: z.number().optional(),
	maxQuantity: z.number().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for price-lists. */
export const priceListsStorage = {
	kind: "relational",
	tables: {
		priceList: {
			shape: priceListsPriceListShape,
		},
		priceEntry: {
			shape: priceListsPriceEntryShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
