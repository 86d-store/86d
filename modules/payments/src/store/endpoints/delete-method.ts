import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PaymentController } from "../../service";

export const deletePaymentMethod = createStoreEndpoint(
	"/payments/methods/:id",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.payments as PaymentController;
		const method = await controller.getPaymentMethod(ctx.params.id);
		if (!method) return { error: "Payment method not found", status: 404 };

		if (method.customerId && method.customerId !== session.user.id) {
			return { error: "Payment method not found", status: 404 };
		}

		const deleted = await controller.deletePaymentMethod(ctx.params.id);
		return { deleted };
	},
);
