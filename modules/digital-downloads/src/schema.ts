import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const digitalDownloadsDownloadableFileShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	name: z.string(),
	url: z.string(),
	fileSize: z.number().optional(),
	mimeType: z.string().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const digitalDownloadsDownloadTokenShape = z.object({
	id: z.string().register(col, { pk: true }),
	token: z.string(),
	fileId: z.string(),
	orderId: z.string().optional(),
	email: z.string(),
	maxDownloads: z.number().optional(),
	downloadCount: z.int().default(0),
	expiresAt: z.coerce.date().optional(),
	revokedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for digital-downloads. */
export const digitalDownloadsStorage = {
	kind: "relational",
	tables: {
		downloadableFile: {
			shape: digitalDownloadsDownloadableFileShape,
		},
		downloadToken: {
			shape: digitalDownloadsDownloadTokenShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
