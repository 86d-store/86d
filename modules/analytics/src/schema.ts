import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const analyticsEventShape = z.object({
	id: z.string().register(col, { pk: true }),
	type: z.string(),
	sessionId: z.string().optional(),
	customerId: z.string().optional(),
	productId: z.string().optional(),
	orderId: z.string().optional(),
	value: z.number().optional(),
	data: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for analytics. */
export const analyticsStorage = {
	kind: "relational",
	tables: {
		event: {
			shape: analyticsEventShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
