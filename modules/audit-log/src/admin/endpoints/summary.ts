import { createAdminEndpoint } from "@86d-app/core/api";
import type { AuditLogController } from "../../service";

export const summary = createAdminEndpoint(
	"/admin/audit-log/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"audit-log"
		] as AuditLogController;
		const result = await controller.getSummary();
		return result;
	},
);
