import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const mediaSchema = {
	asset: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			altText: { type: "string", required: false },
			url: { type: "string", required: true },
			mimeType: { type: "string", required: true },
			size: { type: "number", required: true },
			width: { type: "number", required: false },
			height: { type: "number", required: false },
			folder: { type: "string", required: false },
			tags: { type: "json", required: true, defaultValue: [] },
			metadata: { type: "json", required: true, defaultValue: {} },
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
	folder: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			parentId: { type: "string", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const mediaTables = transcodeModuleSchema(mediaSchema);
