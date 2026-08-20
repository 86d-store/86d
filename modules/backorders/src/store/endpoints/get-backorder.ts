import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const getBackorder = createStoreEndpoint(
	"/backorders/:id",
	{ method: "GET", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const backorder = await controller.getBackorder(ctx.params.id);
		if (!backorder) {
			return { error: "Backorder not found", backorder: null };
		}
		return { backorder };
	},
);
