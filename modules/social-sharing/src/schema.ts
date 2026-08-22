import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const socialSharingShareEventShape = z.object({
	id: z.string().register(col, { pk: true }),
	targetType: z.string(),
	targetId: z.string(),
	network: z.string(),
	url: z.string(),
	referrer: z.string().optional(),
	sessionId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const socialSharingShareSettingsShape = z.object({
	id: z.string().register(col, { pk: true }),
	enabledNetworks: z.array(z.unknown()).default([]),
	defaultMessage: z.string().optional(),
	hashtags: z.array(z.unknown()).default([]),
	customTemplates: z.record(z.string(), z.unknown()).default({}),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for social-sharing. */
export const socialSharingStorage = {
	kind: "relational",
	tables: {
		shareEvent: {
			shape: socialSharingShareEventShape,
		},
		shareSettings: {
			shape: socialSharingShareSettingsShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
