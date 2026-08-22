import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const mediaAssetShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	altText: z.string().optional(),
	url: z.string(),
	mimeType: z.string(),
	size: z.number(),
	width: z.number().optional(),
	height: z.number().optional(),
	folder: z.string().optional(),
	tags: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const mediaFolderShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	parentId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for media. */
export const mediaStorage = {
	kind: "relational",
	tables: {
		asset: {
			shape: mediaAssetShape,
		},
		folder: {
			shape: mediaFolderShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
