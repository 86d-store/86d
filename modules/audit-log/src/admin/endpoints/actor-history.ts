import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuditLogController } from "../../service";

export const actorHistory = createAdminEndpoint(
	"/admin/audit-log/actor/:actorId",
	{
		method: "GET",
		params: z.object({
			actorId: z.string(),
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
		const entries = await controller.listForActor(ctx.params.actorId, {
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { entries };
	},
);
