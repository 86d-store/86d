import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const newsletterSchema = {
	subscriber: {
		fields: {
			id: { type: "string", required: true },
			email: { type: "string", required: true },
			firstName: { type: "string", required: false },
			lastName: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "active" },
			source: { type: "string", required: false },
			tags: { type: "json", required: true, defaultValue: [] },
			metadata: { type: "json", required: true, defaultValue: {} },
			subscribedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			unsubscribedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	campaign: {
		fields: {
			id: { type: "string", required: true },
			subject: { type: "string", required: true },
			body: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "draft" },
			recipientCount: { type: "number", required: true, defaultValue: 0 },
			sentCount: { type: "number", required: true, defaultValue: 0 },
			failedCount: { type: "number", required: true, defaultValue: 0 },
			tags: { type: "json", required: true, defaultValue: [] },
			scheduledAt: { type: "date", required: false },
			sentAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const newsletterTables = transcodeModuleSchema(newsletterSchema);
