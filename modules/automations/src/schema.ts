import type { ModuleSchema } from "@86d-app/core/types/schema";

export const automationsSchema = {
	automation: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			name: {
				type: "string",
				required: true,
			},
			description: {
				type: "string",
				required: false,
			},
			status: {
				type: ["active", "paused", "draft"],
				required: true,
				defaultValue: "draft",
			},
			triggerEvent: {
				type: "string",
				required: true,
			},
			conditions: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			actions: {
				type: "json",
				required: true,
			},
			priority: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			runCount: {
				type: "number",
				required: true,
				defaultValue: 0,
			},
			lastRunAt: {
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
	automationExecution: {
		fields: {
			id: {
				type: "string",
				required: true,
			},
			automationId: {
				type: "string",
				required: true,
				references: {
					model: "automation",
					field: "id",
					onDelete: "cascade",
				},
			},
			triggerEvent: {
				type: "string",
				required: true,
			},
			triggerPayload: {
				type: "json",
				required: false,
				defaultValue: {},
			},
			status: {
				type: ["pending", "running", "completed", "failed", "skipped"],
				required: true,
				defaultValue: "pending",
			},
			results: {
				type: "json",
				required: false,
				defaultValue: [],
			},
			error: {
				type: "string",
				required: false,
			},
			startedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			completedAt: {
				type: "date",
				required: false,
			},
		},
	},
} satisfies ModuleSchema;
