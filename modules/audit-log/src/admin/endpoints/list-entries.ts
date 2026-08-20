import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuditLogController } from "../../service";

export const listEntries = createAdminEndpoint(
	"/admin/audit-log/entries",
	{
		method: "GET",
		query: z.object({
			action: z
				.enum([
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
				])
				.optional(),
			resource: z.string().optional(),
			actorId: z.string().optional(),
			actorType: z.enum(["admin", "system", "api_key"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"audit-log"
		] as AuditLogController;
		const result = await controller.list({
			action: ctx.query.action,
			resource: ctx.query.resource,
			actorId: ctx.query.actorId,
			actorType: ctx.query.actorType,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return result;
	},
);
