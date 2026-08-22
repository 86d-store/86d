import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const flashSalesFlashSaleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	status: z.string(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const flashSalesFlashSaleProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	flashSaleId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	salePrice: z.number(),
	originalPrice: z.number(),
	stockLimit: z.number().optional(),
	stockSold: z.number(),
	sortOrder: z.number(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for flash-sales. */
export const flashSalesStorage = {
	kind: "relational",
	tables: {
		flashSale: {
			shape: flashSalesFlashSaleShape,
		},
		flashSaleProduct: {
			shape: flashSalesFlashSaleProductShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
