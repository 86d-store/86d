import type { ModuleSchema } from "@86d-app/core/types/schema";

export const ticketsSchema = {
	ticketCategory: {
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
			position: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			isActive: {
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
	ticket: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			number: {
				type: "number",
				required: true,
				unique: true,
			},
			categoryId: {
				type: "string",
				required: false,
				references: {
					model: "ticketCategory",
					field: "id",
					onDelete: "set null",
				},
			},
			subject: {
				type: "string",
				required: true,
			},
			description: {
				type: "string",
				required: true,
			},
			status: {
				type: "string",
				required: true,
				defaultValue: "open",
			},
			priority: {
				type: "string",
				required: true,
				defaultValue: "normal",
			},
			customerEmail: {
				type: "string",
				required: true,
			},
			customerName: {
				type: "string",
				required: true,
			},
			customerId: {
				type: "string",
				required: false,
			},
			orderId: {
				type: "string",
				required: false,
			},
			assigneeId: {
				type: "string",
				required: false,
			},
			assigneeName: {
				type: "string",
				required: false,
			},
			tags: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			closedAt: {
				type: "date",
				required: false,
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
	ticketMessage: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			ticketId: {
				type: "string",
				required: true,
				references: {
					model: "ticket",
					field: "id",
					onDelete: "cascade",
				},
			},
			body: {
				type: "string",
				required: true,
			},
			authorType: {
				type: "string",
				required: true,
			},
			authorId: {
				type: "string",
				required: false,
			},
			authorName: {
				type: "string",
				required: true,
			},
			authorEmail: {
				type: "string",
				required: false,
			},
			isInternal: {
				type: "boolean",
				required: true,
				defaultValue: false,
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
		},
	},
} satisfies ModuleSchema;
