import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const newsletterSubscriberShape = z.object({
	id: z.string().register(col, { pk: true }),
	email: z.string(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	status: z.string().default("active"),
	source: z.string().optional(),
	tags: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	subscribedAt: z.coerce.date().default(() => new Date()),
	unsubscribedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const newsletterCampaignShape = z.object({
	id: z.string().register(col, { pk: true }),
	subject: z.string(),
	body: z.string(),
	status: z.string().default("draft"),
	recipientCount: z.int().default(0),
	sentCount: z.int().default(0),
	failedCount: z.int().default(0),
	tags: z.array(z.unknown()).default([]),
	scheduledAt: z.coerce.date().optional(),
	sentAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for newsletter. */
export const newsletterStorage = {
	kind: "relational",
	tables: {
		subscriber: {
			shape: newsletterSubscriberShape,
		},
		campaign: {
			shape: newsletterCampaignShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
