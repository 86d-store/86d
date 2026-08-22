import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";
import { recalculateTax, taxRecalculationError } from "./recalculate-tax";

const addressSchema = z.object({
	firstName: z.string().min(1).max(200).transform(sanitizeText),
	lastName: z.string().min(1).max(200).transform(sanitizeText),
	company: z.string().max(200).transform(sanitizeText).optional(),
	line1: z.string().min(1).max(500).transform(sanitizeText),
	line2: z.string().max(500).transform(sanitizeText).optional(),
	city: z.string().min(1).max(200).transform(sanitizeText),
	state: z.string().min(1).max(200).transform(sanitizeText),
	postalCode: z.string().min(1).max(20),
	country: z.string().length(2),
	phone: z.string().max(50).transform(sanitizeText).optional(),
});

export const updateSession = createStoreEndpoint(
	"/checkout/sessions/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			expectedRevision: checkoutRevisionSchema,
			guestEmail: z.string().email().max(320).optional(),
			shippingAddress: addressSchema.optional(),
			billingAddress: addressSchema.optional(),
			shippingAmount: z.number().int().nonnegative().optional(),
			shippingMethodName: z
				.string()
				.max(200)
				.transform(sanitizeText)
				.optional(),
			paymentMethod: z.string().max(100).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		if (ctx.body.shippingAmount !== undefined) {
			return {
				code: "CHECKOUT_CALLER_TOTALS_REJECTED",
				error:
					"Shipping amounts must come from an authoritative Store decision.",
				status: 422,
			};
		}

		const controller = ctx.context.controllers.checkout as CheckoutController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!(await canAccessCheckout(ctx, existing))) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (
			ctx.body.shippingMethodName !== undefined ||
			ctx.body.paymentMethod !== undefined
		) {
			return {
				code: "CHECKOUT_CALLER_OPTION_REJECTED",
				error:
					"Shipping and Payment selections must use Store-issued local option identifiers.",
				status: 422,
			};
		}

		const mutation = await runCheckoutMutation(() =>
			controller.update(
				ctx.params.id,
				{
					guestEmail: ctx.body.guestEmail,
					shippingAddress: ctx.body.shippingAddress,
					billingAddress: ctx.body.billingAddress,
				},
				ctx.body.expectedRevision,
			),
		);
		if (!mutation.ok) return mutation.response;
		const session = mutation.value;
		if (!session) {
			return { error: "Cannot update this checkout session", status: 422 };
		}

		if (!ctx.body.shippingAddress) {
			return { session };
		}

		const tax = await recalculateTax(
			session,
			controller,
			ctx.context.capabilities,
		);
		if (!tax.ok) {
			return taxRecalculationError(tax, session);
		}

		return { session: tax.session };
	},
);
