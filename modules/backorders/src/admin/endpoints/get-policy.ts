import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BackordersController } from "../../service";

export const getPolicy = createAdminEndpoint(
	"/admin/backorders/policies/:productId",
	{ method: "GET", params: z.object({ productId: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const policy = await controller.getPolicy(ctx.params.productId);
		if (!policy) {
			return { error: "Policy not found", policy: null };
		}
		return { policy };
	},
);
