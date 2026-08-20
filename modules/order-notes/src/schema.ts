import type { ModuleSchema } from "@86d-app/core/types/schema";

export const orderNotesSchema = {
	orderNote: {
		fields: {
			id: { type: "string", required: true },
			orderId: { type: "string", required: true },
			authorId: { type: "string", required: true },
			authorName: { type: "string", required: true },
			authorType: { type: "string", required: true },
			content: { type: "string", required: true },
			isInternal: { type: "boolean", required: true, defaultValue: false },
			isPinned: { type: "boolean", required: true, defaultValue: false },
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
} satisfies ModuleSchema;
