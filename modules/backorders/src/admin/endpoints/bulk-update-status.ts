import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const bulkUpdateStatus = createAdminEndpoint(
	"/admin/backorders/bulk-status",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
			status: z.enum([
				"pending",
				"confirmed",
				"allocated",
				"shipped",
				"delivered",
				"cancelled",
			]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const result = await controller.bulkUpdateStatus(
			ctx.body.ids,
			ctx.body.status,
		);
		return result;
	},
);
