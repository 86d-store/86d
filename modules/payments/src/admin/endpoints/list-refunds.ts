import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PaymentController } from "../../service";

export const listRefunds = createAdminEndpoint(
	"/admin/payments/:id/refunds",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		const refunds = await controller.listRefunds(ctx.params.id);
		return { refunds };
	},
);
