import type { ModuleSchema } from "@86d-app/core/types/schema";

export const socialSharingSchema = {
	shareEvent: {
		fields: {
			id: { type: "string", required: true },
			targetType: { type: "string", required: true },
			targetId: { type: "string", required: true },
			network: { type: "string", required: true },
			url: { type: "string", required: true },
			referrer: { type: "string", required: false },
			sessionId: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	shareSettings: {
		fields: {
			id: { type: "string", required: true },
			enabledNetworks: { type: "json", required: true, defaultValue: [] },
			defaultMessage: { type: "string", required: false },
			hashtags: { type: "json", required: true, defaultValue: [] },
			customTemplates: { type: "json", required: true, defaultValue: {} },
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
