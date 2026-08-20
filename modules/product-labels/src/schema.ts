import type { ModuleSchema } from "@86d-app/core/types/schema";

export const productLabelsSchema = {
	label: {
		fields: {
			id: { type: "string", required: true },
			name: { type: "string", required: true },
			slug: { type: "string", required: true },
			displayText: { type: "string", required: true },
			type: { type: "string", required: true },
			color: { type: "string", required: false },
			backgroundColor: { type: "string", required: false },
			icon: { type: "string", required: false },
			priority: { type: "number", required: true },
			isActive: { type: "boolean", required: true },
			startsAt: { type: "date", required: false },
			endsAt: { type: "date", required: false },
			conditions: { type: "json", required: false },
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
	productLabel: {
		fields: {
			id: { type: "string", required: true },
			productId: { type: "string", required: true },
			labelId: { type: "string", required: true },
			position: { type: "string", required: false },
			assignedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
