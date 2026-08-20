import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const settingsSchema = {
	storeSetting: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			key: {
				type: "string",
				required: true,
				unique: true,
			},
			value: {
				type: "string",
				required: true,
			},
			group: {
				type: [
					"general",
					"contact",
					"social",
					"legal",
					"commerce",
					"appearance",
				],
				required: true,
				defaultValue: "general",
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

export const settingsTables = transcodeModuleSchema(settingsSchema);
