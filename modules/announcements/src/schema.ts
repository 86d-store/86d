import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const announcementsAnnouncementShape = z.object({
	id: z.string().register(col, { pk: true }),
	title: z.string(),
	content: z.string(),
	type: z.enum(["bar", "banner", "popup"]).default("bar"),
	position: z.enum(["top", "bottom"]).default("top"),
	linkUrl: z.string().optional(),
	linkText: z.string().optional(),
	backgroundColor: z.string().optional(),
	textColor: z.string().optional(),
	iconName: z.string().optional(),
	priority: z.int().default(0),
	isActive: z.boolean().default(true),
	isDismissible: z.boolean().default(true),
	startsAt: z.coerce.date().optional(),
	endsAt: z.coerce.date().optional(),
	targetAudience: z.enum(["all", "authenticated", "guest"]).default("all"),
	impressions: z.int().default(0),
	clicks: z.int().default(0),
	dismissals: z.int().default(0),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for announcements. */
export const announcementsStorage = {
	kind: "relational",
	tables: {
		announcement: {
			shape: announcementsAnnouncementShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
