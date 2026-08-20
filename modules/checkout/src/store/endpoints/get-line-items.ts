import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";

export const getLineItems = createStoreEndpoint(
	"/checkout/sessions/:id/items",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const session = await controller.getById(ctx.params.id);
		if (!session) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!(await canAccessCheckout(ctx, session))) {
			return { error: "Checkout session not found", status: 404 };
		}

		const lineItems = await controller.getLineItems(ctx.params.id);
		return { lineItems };
	},
);
