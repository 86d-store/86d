import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const orderNotesOrderNoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string(),
	authorId: z.string(),
	authorName: z.string(),
	authorType: z.string(),
	content: z.string(),
	isInternal: z.boolean().default(false),
	isPinned: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for order-notes. */
export const orderNotesStorage = {
	kind: "relational",
	tables: {
		orderNote: {
			shape: orderNotesOrderNoteShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
