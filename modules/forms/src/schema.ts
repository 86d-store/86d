import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const formsFormShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	fields: z.array(z.unknown()).default([]),
	submitLabel: z.string().default("Submit"),
	successMessage: z.string().default("Thank you for your submission."),
	isActive: z.boolean().default(true),
	notifyEmail: z.string().optional(),
	honeypotEnabled: z.boolean().default(true),
	maxSubmissions: z.int().default(0),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const formsFormSubmissionShape = z.object({
	id: z.string().register(col, { pk: true }),
	formId: z.string().register(col, {
		references: { table: "self.form", column: "id", onDelete: "cascade" },
	}),
	values: z.record(z.string(), z.unknown()),
	ipAddress: z.string().optional(),
	status: z.string().default("unread"),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for forms. */
export const formsStorage = {
	kind: "relational",
	tables: {
		form: {
			shape: formsFormShape,
		},
		formSubmission: {
			shape: formsFormSubmissionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
