import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PaymentController } from "../../service";

export const cancelIntent = createStoreEndpoint(
	"/payments/intents/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.payments as PaymentController;
		const existing = await controller.getIntent(ctx.params.id);
		if (!existing) return { error: "Payment intent not found", status: 404 };

		if (existing.customerId && existing.customerId !== session.user.id) {
			return { error: "Payment intent not found", status: 404 };
		}

		const intent = await controller.cancelIntent(ctx.params.id);
		if (!intent) return { error: "Payment intent not found", status: 404 };

		return { intent };
	},
);
