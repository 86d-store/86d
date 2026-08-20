import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const collectionsSchema = {
	collection: {
		fields: {
			id: { type: "string", required: true },
			title: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			description: { type: "string", required: false },
			image: { type: "string", required: false },
			type: { type: "string", required: true },
			sortOrder: { type: "string", required: true },
			isActive: { type: "boolean", required: true },
			isFeatured: { type: "boolean", required: true },
			position: { type: "number", required: true },
			conditions: { type: "json", required: false },
			seoTitle: { type: "string", required: false },
			seoDescription: { type: "string", required: false },
			publishedAt: { type: "date", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	collectionProduct: {
		fields: {
			id: { type: "string", required: true },
			collectionId: { type: "string", required: true, index: true },
			productId: { type: "string", required: true, index: true },
			position: { type: "number", required: true },
			addedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const collectionsTables = transcodeModuleSchema(collectionsSchema);
