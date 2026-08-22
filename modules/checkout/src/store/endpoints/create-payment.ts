import { createStoreEndpoint } from "@86d-app/core/api";
import { paymentCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import type { CheckoutController } from "../../service";

export const createPayment = createStoreEndpoint(
	"/checkout/sessions/:id/payment",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z
			.object({
				paymentMethodNonce: z.string().max(4096).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Checkout session not found", status: 404 };
		}

		// Ownership check
		const userId = ctx.context.session?.user.id;
		if (existing.customerId && (!userId || existing.customerId !== userId)) {
			return { error: "Checkout session not found", status: 404 };
		}

		// Cannot create payment for completed/expired sessions
		if (existing.status === "completed" || existing.status === "expired") {
			return { error: "Cannot process payment for this session", status: 422 };
		}

		// If total is zero (fully covered by gift card/discount), skip payment
		if (existing.total === 0) {
			const updated = await controller.setPaymentIntent(
				ctx.params.id,
				"no_payment_required",
				"succeeded",
			);
			return {
				payment: {
					id: "no_payment_required",
					status: "succeeded",
					amount: 0,
					currency: existing.currency,
				},
				session: updated,
			};
		}

		// If a payment intent already exists, return it
		if (
			existing.paymentIntentId &&
			existing.paymentIntentId !== "no_payment_required"
		) {
			const existingIntent = await ctx.context.capabilities.invoke(
				paymentCheckoutCapability,
				{ operation: "get", intentId: existing.paymentIntentId },
			);
			if (existingIntent.ok) {
				const intent = existingIntent.decision;
				const action = intent.clientAction;
				return {
					payment: {
						id: intent.id,
						status: intent.status,
						amount: intent.amount,
						currency: intent.currency,
						...(action?.type === "client_secret"
							? { clientSecret: action.clientSecret }
							: {}),
						...(action?.type === "paypal_approval"
							? { paypalOrderId: action.orderId }
							: {}),
						...(action?.type === "braintree_tokenize"
							? { braintreeClientToken: action.clientToken }
							: {}),
						...(action?.type === "square_tokenize"
							? { squarePayment: true }
							: {}),
					},
					session: existing,
				};
			} else if (existingIntent.failure.code !== "PAYMENT_NOT_FOUND") {
				return {
					code: "CHECKOUT_PAYMENT_UNAVAILABLE",
					error: "An authoritative payment decision is unavailable.",
					status: 503,
				};
			}
		}

		// Create the intent through the payments module
		const email = existing.guestEmail ?? ctx.context.session?.user.email;
		const paymentMethodNonce = ctx.body?.paymentMethodNonce;
		const intentMetadata: Record<string, unknown> = {
			cartId: existing.cartId,
		};
		if (paymentMethodNonce) {
			intentMetadata.paymentMethodNonce = paymentMethodNonce;
		}
		const paymentResult = await ctx.context.capabilities.invoke(
			paymentCheckoutCapability,
			{
				operation: "create",
				amount: existing.total,
				currency: existing.currency,
				...(existing.customerId ? { customerId: existing.customerId } : {}),
				...(email ? { email } : {}),
				checkoutSessionId: ctx.params.id,
				metadata: intentMetadata,
			},
		);
		if (!paymentResult.ok) {
			return {
				code: "CHECKOUT_PAYMENT_UNAVAILABLE",
				error: "An authoritative payment decision is unavailable.",
				status: 503,
			};
		}
		const intent = paymentResult.decision;

		const action = intent.clientAction;

		// If the provider returned a clientSecret, the frontend will handle
		// confirmation via provider-specific UI (e.g. Stripe PaymentElement).
		// Do NOT auto-confirm — store the intent with its initial status.
		if (action?.type === "client_secret") {
			const updated = await controller.setPaymentIntent(
				ctx.params.id,
				intent.id,
				intent.status,
			);
			return {
				payment: {
					id: intent.id,
					status: intent.status,
					amount: intent.amount,
					currency: intent.currency,
					clientSecret: action.clientSecret,
				},
				session: updated,
			};
		}

		// Provider-specific client-side flows: return the necessary data
		// so the frontend can render the appropriate payment UI.
		// PayPal: requires customer approval via PayPal buttons before capture.
		if (action?.type === "paypal_approval") {
			const updated = await controller.setPaymentIntent(
				ctx.params.id,
				intent.id,
				intent.status,
			);
			return {
				payment: {
					id: intent.id,
					status: intent.status,
					amount: intent.amount,
					currency: intent.currency,
					paypalOrderId: action.orderId,
				},
				session: updated,
			};
		}

		// Braintree: requires client-side tokenization via Drop-in UI.
		// Return the client token so the frontend can collect a nonce.
		if (action?.type === "braintree_tokenize") {
			return {
				payment: {
					id: intent.id,
					status: intent.status,
					amount: intent.amount,
					currency: intent.currency,
					braintreeClientToken: action.clientToken,
				},
				session: existing,
			};
		}

		// Square: requires client-side tokenization via Web Payments SDK.
		if (action?.type === "square_tokenize") {
			return {
				payment: {
					id: intent.id,
					status: intent.status,
					amount: intent.amount,
					currency: intent.currency,
					squarePayment: true,
				},
				session: existing,
			};
		}

		// No clientSecret and no provider-specific flow — auto-confirm
		const confirmation = await ctx.context.capabilities.invoke(
			paymentCheckoutCapability,
			{ operation: "confirm", intentId: intent.id },
		);
		if (!confirmation.ok) {
			return {
				code: "CHECKOUT_PAYMENT_UNAVAILABLE",
				error: "The payment could not be confirmed.",
				status: 503,
			};
		}
		const finalStatus = confirmation.decision.status;

		// Store the intent on the checkout session
		const updated = await controller.setPaymentIntent(
			ctx.params.id,
			intent.id,
			finalStatus,
		);

		return {
			payment: {
				id: intent.id,
				status: finalStatus,
				amount: intent.amount,
				currency: intent.currency,
			},
			session: updated,
		};
	},
);
