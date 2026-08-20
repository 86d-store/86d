import type { ModuleSchema } from "@86d-app/core/types/schema";

export const toastSchema = {
	syncRecord: {
		fields: {
			id: { type: "string", required: true },
			entityType: { type: "string", required: true },
			entityId: { type: "string", required: true },
			externalId: { type: "string", required: true },
			direction: { type: "string", required: true },
			status: { type: "string", required: true, defaultValue: "pending" },
			error: { type: "string", required: false },
			syncedAt: { type: "date", required: false },
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
	menuMapping: {
		fields: {
			id: { type: "string", required: true },
			localProductId: { type: "string", required: true },
			externalMenuItemId: { type: "string", required: true },
			isActive: { type: "boolean", required: true, defaultValue: true },
			lastSyncedAt: { type: "date", required: false },
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
