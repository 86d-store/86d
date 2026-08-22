import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const redirectsRedirectShape = z.object({
	id: z.string().register(col, { pk: true }),
	sourcePath: z.string().register(col, { index: true }),
	targetPath: z.string(),
	statusCode: z.number(),
	isActive: z.boolean(),
	isRegex: z.boolean(),
	preserveQueryString: z.boolean(),
	note: z.string().optional(),
	hitCount: z.number(),
	lastHitAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for redirects. */
export const redirectsStorage = {
	kind: "relational",
	tables: {
		redirect: {
			shape: redirectsRedirectShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
