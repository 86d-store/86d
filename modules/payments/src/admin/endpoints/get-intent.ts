import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PaymentController } from "../../service";

export const getIntentAdmin = createAdminEndpoint(
	"/admin/payments/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		const intent = await controller.getIntent(ctx.params.id);
		if (!intent) return { error: "Payment intent not found", status: 404 };
		return { intent };
	},
);
