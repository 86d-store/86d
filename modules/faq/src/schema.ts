import type { ModuleSchema } from "@86d-app/core/types/schema";

export const faqSchema = {
	faqCategory: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			description: {
				type: "string",
				required: false,
			},
			icon: {
				type: "string",
				required: false,
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			isVisible: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
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
	faqItem: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			categoryId: {
				type: "string",
				required: true,
				references: {
					model: "faqCategory",
					field: "id",
					onDelete: "cascade",
				},
			},
			question: {
				type: "string",
				required: true,
			},
			answer: {
				type: "string",
				required: true,
			},
			slug: {
				type: "string",
				required: true,
				unique: true,
			},
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			isVisible: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			tags: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			helpfulCount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			notHelpfulCount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
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
