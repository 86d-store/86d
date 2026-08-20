import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const auditLogAuditEntryShape = z.object({
	id: z.string().register(col, { pk: true }),
	action: z.enum([
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
	]),
	resource: z.string(),
	resourceId: z.string().optional(),
	actorId: z.string().optional(),
	actorEmail: z.string().optional(),
	actorType: z.enum(["admin", "system", "api_key"]).default("admin"),
	description: z.string(),
	changes: z.record(z.string(), z.unknown()).default({}),
	metadata: z.record(z.string(), z.unknown()).default({}),
	ipAddress: z.string().optional(),
	userAgent: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for audit-log. */
export const auditLogStorage = {
	kind: "relational",
	tables: {
		auditEntry: {
			shape: auditLogAuditEntryShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
