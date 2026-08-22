import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PaymentController } from "../../service";

export const confirmIntent = createStoreEndpoint(
	"/payments/intents/:id/confirm",
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
		try {
			const intent = await controller.confirmIntent(ctx.params.id);
			if (!intent) return { error: "Payment intent not found", status: 404 };

			if (intent.customerId && intent.customerId !== session.user.id) {
				return { error: "Payment intent not found", status: 404 };
			}

			return { intent };
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Cannot confirm payment";
			return { error: message, status: 400 };
		}
	},
);
