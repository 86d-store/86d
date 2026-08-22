import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const settingsStoreSettingShape = z.object({
	id: z.string().register(col, { pk: true }),
	key: z.string().register(col, { unique: true }),
	value: z.string(),
	group: z
		.enum(["general", "contact", "social", "legal", "commerce", "appearance"])
		.default("general"),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for settings. */
export const settingsStorage = {
	kind: "relational",
	tables: {
		storeSetting: {
			shape: settingsStoreSettingShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
