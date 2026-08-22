import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";
import { recalculateTax, taxRecalculationError } from "./recalculate-tax";

export const removeDiscount = createStoreEndpoint(
	"/checkout/sessions/:id/discount/remove",
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
			controller.removeDiscount(ctx.params.id, ctx.body.expectedRevision),
		);
		if (!mutation.ok) return mutation.response;
		const session = mutation.value;
		if (!session) {
			return { error: "Cannot modify this checkout session", status: 422 };
		}

		// Recalculate tax now that discount is removed (taxable amount restored)
		const tax = await recalculateTax(
			session,
			controller,
			ctx.context.capabilities,
		);
		if (!tax.ok) {
			return taxRecalculationError(tax);
		}

		return { session: tax.session };
	},
);
