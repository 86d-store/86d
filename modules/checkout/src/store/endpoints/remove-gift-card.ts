import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";

export const removeGiftCard = createStoreEndpoint(
	"/checkout/sessions/:id/gift-card/remove",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({ expectedRevision: checkoutRevisionSchema }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!(await canAccessCheckout(ctx, existing))) {
			return { error: "Checkout session not found", status: 404 };
		}

		const mutation = await runCheckoutMutation(() =>
			controller.removeGiftCard(ctx.params.id, ctx.body.expectedRevision),
		);
		if (!mutation.ok) return mutation.response;
		const session = mutation.value;
		if (!session) {
			return { error: "Cannot modify this checkout session", status: 422 };
		}

		return { session };
	},
);
