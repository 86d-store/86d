import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PaymentController } from "../../service";

export const getIntent = createStoreEndpoint(
	"/payments/intents/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.payments as PaymentController;
		const intent = await controller.getIntent(ctx.params.id);
		if (!intent) return { error: "Payment intent not found", status: 404 };
		return { intent };
	},
);
