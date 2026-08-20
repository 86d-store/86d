import { transcodeModuleSchema } from "@86d-app/core/schema";
import type { ModuleSchema } from "@86d-app/core/types/schema";

export const pagesSchema = {
	page: {
		fields: {
			id: { type: "string", required: true },
			title: { type: "string", required: true },
			slug: { type: "string", required: true, unique: true },
			content: { type: "string", required: true },
			excerpt: { type: "string", required: false },
			status: {
				type: ["draft", "published", "archived"],
				required: true,
				defaultValue: "draft",
			},
			template: { type: "string", required: false },
			metaTitle: { type: "string", required: false },
			metaDescription: { type: "string", required: false },
			featuredImage: { type: "string", required: false },
			position: { type: "number", required: true, defaultValue: 0 },
			showInNavigation: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
			parentId: {
				type: "string",
				required: false,
				references: {
					model: "page",
					field: "id",
					onDelete: "set null",
				},
			},
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
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;

export const pagesTables = transcodeModuleSchema(pagesSchema);
