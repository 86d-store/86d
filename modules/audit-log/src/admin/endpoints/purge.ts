import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuditLogController } from "../../service";

export const purge = createAdminEndpoint(
	"/admin/audit-log/purge",
	{
		method: "POST",
		body: z.object({
			olderThanDays: z.number().int().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"audit-log"
		] as AuditLogController;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - ctx.body.olderThanDays);
		const deleted = await controller.purge(cutoff);
		return { deleted, cutoffDate: cutoff.toISOString() };
	},
);
