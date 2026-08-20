import { createStoreEndpoint } from "@86d-app/core/api";
import type { PaymentController } from "../../service";

export const listPaymentMethods = createStoreEndpoint(
	"/payments/methods",
	{
		method: "GET",
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.payments as PaymentController;
		const methods = await controller.listPaymentMethods(session.user.id);
		return { methods };
	},
);
