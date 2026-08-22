import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const toastSyncRecordShape = z.object({
	id: z.string().register(col, { pk: true }),
	entityType: z.string(),
	entityId: z.string(),
	externalId: z.string(),
	direction: z.string(),
	status: z.string().default("pending"),
	error: z.string().optional(),
	syncedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const toastMenuMappingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	externalMenuItemId: z.string(),
	isActive: z.boolean().default(true),
	lastSyncedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for toast. */
export const toastStorage = {
	kind: "relational",
	tables: {
		syncRecord: {
			shape: toastSyncRecordShape,
		},
		menuMapping: {
			shape: toastMenuMappingShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
