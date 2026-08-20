import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AbandonedCartController } from "../../service";

export const bulkExpire = createAdminEndpoint(
	"/admin/abandoned-carts/bulk-expire",
	{
		method: "POST",
		body: z.object({
			olderThanDays: z.number().int().min(1).max(365).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const expired = await controller.bulkExpire(ctx.body.olderThanDays);
		return { expired };
	},
);
