import type { ModuleSchema } from "@86d-app/core/types/schema";

export const customerGroupsSchema = {
	customerGroup: {
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
			type: {
				type: "string",
				required: true,
				defaultValue: "manual",
			},
			isActive: {
				type: "boolean",
				required: true,
				defaultValue: true,
			},
			priority: {
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
	groupMembership: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			groupId: {
				type: "string",
				required: true,
				references: {
					model: "customerGroup",
					field: "id",
					onDelete: "cascade",
				},
			},
			customerId: {
				type: "string",
				required: true,
			},
			joinedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			expiresAt: {
				type: "date",
				required: false,
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
		},
	},
	groupRule: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			groupId: {
				type: "string",
				required: true,
				references: {
					model: "customerGroup",
					field: "id",
					onDelete: "cascade",
				},
			},
			field: {
				type: "string",
				required: true,
			},
			operator: {
				type: "string",
				required: true,
			},
			value: {
				type: "string",
				required: true,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	groupPriceAdjustment: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			groupId: {
				type: "string",
				required: true,
				references: {
					model: "customerGroup",
					field: "id",
					onDelete: "cascade",
				},
			},
			adjustmentType: {
				type: "string",
				required: true,
			},
			value: {
				type: "number",
				required: true,
			},
			scope: {
				type: "string",
				required: true,
				defaultValue: "all",
			},
			scopeId: {
				type: "string",
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
} satisfies ModuleSchema;
