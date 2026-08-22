import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AuditLogController } from "../../service";

export const resourceHistory = createAdminEndpoint(
	"/admin/audit-log/resource/:resource/:resourceId",
	{
		method: "GET",
		params: z.object({
			resource: z.string(),
			resourceId: z.string(),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"audit-log"
		] as AuditLogController;
		const entries = await controller.listForResource(
			ctx.params.resource,
			ctx.params.resourceId,
			{
				take: ctx.query.take,
				skip: ctx.query.skip,
			},
		);
		return { entries };
	},
);
