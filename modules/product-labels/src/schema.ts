import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const productLabelsLabelShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string(),
	displayText: z.string(),
	type: z.string(),
	color: z.string().optional(),
	backgroundColor: z.string().optional(),
	icon: z.string().optional(),
	priority: z.number(),
	isActive: z.boolean(),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	conditions: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const productLabelsProductLabelShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	labelId: z.string(),
	position: z.string().optional(),
	assignedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for product-labels. */
export const productLabelsStorage = {
	kind: "relational",
	tables: {
		label: {
			shape: productLabelsLabelShape,
		},
		productLabel: {
			shape: productLabelsProductLabelShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
