import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const comparisonsComparisonItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string().optional(),
	sessionId: z.string().optional(),
	productId: z.string(),
	productName: z.string(),
	productSlug: z.string(),
	productImage: z.string().optional(),
	productPrice: z.number().optional(),
	productCategory: z.string().optional(),
	attributes: z.record(z.string(), z.unknown()).optional(),
	addedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for comparisons. */
export const comparisonsStorage = {
	kind: "relational",
	tables: {
		comparisonItem: {
			shape: comparisonsComparisonItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
