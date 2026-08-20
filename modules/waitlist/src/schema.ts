import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const waitlistWaitlistEntryShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	productName: z.string(),
	variantId: z.string().optional(),
	variantLabel: z.string().optional(),
	email: z.string(),
	customerId: z.string().optional(),
	status: z.string(),
	notifiedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for waitlist. */
export const waitlistStorage = {
	kind: "relational",
	tables: {
		waitlistEntry: {
			shape: waitlistWaitlistEntryShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
