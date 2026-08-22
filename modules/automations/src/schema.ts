import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const automationsAutomationShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	status: z.enum(["active", "paused", "draft"]).default("draft"),
	triggerEvent: z.string(),
	conditions: z.array(z.unknown()).default([]),
	actions: z.record(z.string(), z.unknown()),
	priority: z.int().default(0),
	runCount: z.int().default(0),
	lastRunAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const automationsAutomationExecutionShape = z.object({
	id: z.string().register(col, { pk: true }),
	automationId: z.string().register(col, {
		references: {
			table: "self.automation",
			column: "id",
			onDelete: "cascade",
		},
	}),
	triggerEvent: z.string(),
	triggerPayload: z.record(z.string(), z.unknown()).default({}),
	status: z
		.enum(["pending", "running", "completed", "failed", "skipped"])
		.default("pending"),
	results: z.array(z.unknown()).default([]),
	error: z.string().optional(),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
});

/** Native Relational storage for automations. */
export const automationsStorage = {
	kind: "relational",
	tables: {
		automation: {
			shape: automationsAutomationShape,
		},
		automationExecution: {
			shape: automationsAutomationExecutionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
