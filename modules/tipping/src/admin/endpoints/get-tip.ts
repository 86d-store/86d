import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TippingController } from "../../service";

export const getTip = createAdminEndpoint(
	"/admin/tipping/tips/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const tip = await controller.getTip(ctx.params.id);

		if (!tip) {
			return { error: "Tip not found", status: 404 };
		}

		return { tip };
	},
);
