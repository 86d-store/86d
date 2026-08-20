import { createStoreEndpoint } from "@86d-app/core/api";
import {
	inventoryCheckoutCapability,
	paymentCheckoutCapability,
} from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";

export const abandonSession = createStoreEndpoint(
	"/checkout/sessions/:id/abandon",
	{
		method: "POST",
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

		// Remember if stock was reserved (processing = stock reserved)
		const wasProcessing = existing.status === "processing";

		const mutation = await runCheckoutMutation(() =>
			controller.abandon(ctx.params.id, ctx.body.expectedRevision),
		);
		if (!mutation.ok) return mutation.response;
		const session = mutation.value;
		if (!session) {
			return { error: "Cannot abandon this checkout session", status: 422 };
		}

		// Release inventory reservations if stock was reserved
		if (wasProcessing && ctx.context.modules.includes("inventory")) {
			const lineItems = await controller.getLineItems(ctx.params.id);
			for (const item of lineItems) {
				const released = await ctx.context.capabilities.invoke(
					inventoryCheckoutCapability,
					{
						operation: "release",
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
						quantity: item.quantity,
					},
				);
				if (!released.ok) {
					return {
						code: "CHECKOUT_INVENTORY_UNAVAILABLE",
						error: "Inventory reservations could not be released.",
						status: 503,
					};
				}
			}
		}

		// Cancel payment intent if one was created
		if (
			existing.paymentIntentId &&
			existing.paymentIntentId !== "no_payment_required"
		) {
			const cancelled = await ctx.context.capabilities.invoke(
				paymentCheckoutCapability,
				{ operation: "cancel", intentId: existing.paymentIntentId },
			);
			if (!cancelled.ok) {
				return {
					code: "CHECKOUT_PAYMENT_UNAVAILABLE",
					error: "The checkout payment could not be cancelled.",
					status: 503,
				};
			}
		}

		return { session };
	},
);
