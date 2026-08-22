import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const recentlyViewedProductViewShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().optional(),
	sessionId: z.string().optional(),
	productId: z.string(),
	productName: z.string(),
	productSlug: z.string(),
	productImage: z.string().optional(),
	productPrice: z.number().optional(),
	viewedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for recently-viewed. */
export const recentlyViewedStorage = {
	kind: "relational",
	tables: {
		productView: {
			shape: recentlyViewedProductViewShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
