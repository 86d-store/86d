import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CheckoutController } from "../../service";

export const adminGetSession = createAdminEndpoint(
	"/admin/checkout/sessions/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const session = await controller.getById(ctx.params.id);
		if (!session) {
			return { error: "Checkout session not found", status: 404 };
		}

		const lineItems = await controller.getLineItems(ctx.params.id);

		return { session, lineItems };
	},
);
