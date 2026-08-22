import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { UberEatsController } from "../../service";

export const syncMenuAdminEndpoint = createAdminEndpoint(
	"/admin/uber-eats/menu-syncs/create",
	{
		method: "POST",
		body: z.object({
			itemCount: z.number().int().min(0),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"uber-eats"
		] as UberEatsController;
		const sync = await controller.syncMenu(ctx.body.itemCount);
		return { sync };
	},
);
