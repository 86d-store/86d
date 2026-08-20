import type { ModuleSchema } from "@86d-app/core/types/schema";

export const auditLogSchema = {
	auditEntry: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			action: {
				type: [
					"create",
					"update",
					"delete",
					"bulk_create",
					"bulk_update",
					"bulk_delete",
					"login",
					"logout",
					"export",
					"import",
					"settings_change",
					"status_change",
					"custom",
				],
				required: true,
			},
			resource: {
				type: "string",
				required: true,
			},
			resourceId: {
				type: "string",
				required: false,
			},
			actorId: {
				type: "string",
				required: false,
			},
			actorEmail: {
				type: "string",
				required: false,
			},
			actorType: {
				type: ["admin", "system", "api_key"],
				required: true,
				defaultValue: "admin",
			},
			description: {
				type: "string",
				required: true,
			},
			changes: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			metadata: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			ipAddress: {
				type: "string",
				required: false,
			},
			userAgent: {
				type: "string",
				required: false,
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
