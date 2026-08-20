import type { ModuleSchema } from "@86d-app/core/types/schema";

export const blogSchema = {
	post: {
		fields: {
			id: { type: "string", required: true },
			title: { type: "string", required: true },
			slug: { type: "string", required: true },
			content: { type: "string", required: true },
			excerpt: { type: "string", required: false },
			coverImage: { type: "string", required: false },
			author: { type: "string", required: false },
			status: { type: "string", required: true, defaultValue: "draft" },
			tags: { type: "json", required: true, defaultValue: [] },
			category: { type: "string", required: false },
			featured: { type: "boolean", required: true, defaultValue: false },
			readingTime: { type: "number", required: true, defaultValue: 0 },
			metaTitle: { type: "string", required: false },
			metaDescription: { type: "string", required: false },
			scheduledAt: { type: "date", required: false },
			publishedAt: { type: "date", required: false },
			views: { type: "number", required: true, defaultValue: 0 },
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
