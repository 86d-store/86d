import { createStoreEndpoint } from "@86d-app/core/api";
import {
	discountCodeCapability,
	giftCardCheckoutCapability,
	inventoryCheckoutCapability,
	orderCreateCapability,
	paymentCheckoutCapability,
	storeCreditCheckoutCapability,
} from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { CheckoutController } from "../../service";

export const completeSession = createStoreEndpoint(
	"/checkout/sessions/:id/complete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(100) }),
		body: z
			.object({
				orderId: z.string().min(1).max(100).optional(),
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

		// Verify payment has been processed (unless total is zero)
		if (existing.total > 0) {
			if (
				!existing.paymentIntentId ||
				existing.paymentIntentId === "no_payment_required"
			) {
				return { error: "Payment has not been initiated", status: 422 };
			}
			const payment = await ctx.context.capabilities.invoke(
				paymentCheckoutCapability,
				{ operation: "get", intentId: existing.paymentIntentId },
			);
			if (!payment.ok) {
				return {
					code: "CHECKOUT_PAYMENT_UNAVAILABLE",
					error: "An authoritative payment status is unavailable.",
					status: payment.failure.code === "PAYMENT_NOT_FOUND" ? 422 : 503,
				};
			}
			if (payment.decision.status !== "succeeded") {
				return { error: "Payment has not been completed", status: 422 };
			}
			await controller.setPaymentIntent(
				ctx.params.id,
				payment.decision.id,
				payment.decision.status,
			);
		}

		// Redeem gift card BEFORE creating the order so the balance is debited
		// before the discount is committed to the order record.
		let actualGiftCardAmount = existing.giftCardAmount;
		if (existing.giftCardCode && existing.giftCardAmount > 0) {
			const redemption = await ctx.context.capabilities.invoke(
				giftCardCheckoutCapability,
				{
					operation: "redeem",
					code: existing.giftCardCode,
					amount: existing.giftCardAmount,
				},
			);
			if (!redemption.ok) {
				return {
					error:
						"Gift card could not be redeemed. It may be expired, inactive, or have insufficient balance.",
					status:
						redemption.failure.code === "GIFT_CARD_REDEMPTION_FAILED"
							? 422
							: 503,
				};
			}
			if (redemption.decision.operation !== "redeem") {
				return {
					code: "CHECKOUT_GIFT_CARD_UNAVAILABLE",
					error: "The gift card redemption decision was invalid.",
					status: 503,
				};
			}
			actualGiftCardAmount = redemption.decision.amount;
		}

		// Debit store credits BEFORE creating the order so the balance is consumed
		// before the order record is written.
		let actualStoreCreditAmount = existing.storeCreditAmount;
		if (existing.customerId && existing.storeCreditAmount > 0) {
			const debit = await ctx.context.capabilities.invoke(
				storeCreditCheckoutCapability,
				{
					operation: "debit",
					customerId: existing.customerId,
					amount: existing.storeCreditAmount,
					description: `Store credit applied to checkout ${existing.id}`,
					referenceType: "checkout_session",
					referenceId: existing.id,
				},
			);
			if (!debit.ok) {
				return {
					error:
						"Store credit could not be applied. Your balance may be insufficient or your account may be frozen.",
					status:
						debit.failure.code === "STORE_CREDIT_DEBIT_FAILED" ? 422 : 503,
				};
			}
			if (debit.decision.operation !== "debit") {
				return {
					code: "CHECKOUT_STORE_CREDIT_UNAVAILABLE",
					error: "The Store credit debit decision was invalid.",
					status: 503,
				};
			}
			actualStoreCreditAmount = debit.decision.amount;
		}

		// Recalculate total if the actual gift card or store credit amounts differ from expected
		const adjustedTotal =
			actualGiftCardAmount !== existing.giftCardAmount ||
			actualStoreCreditAmount !== existing.storeCreditAmount
				? Math.max(
						0,
						existing.subtotal +
							existing.taxAmount +
							existing.shippingAmount -
							existing.discountAmount -
							actualGiftCardAmount -
							actualStoreCreditAmount,
					)
				: existing.total;

		// Create the authoritative Order through its owner capability.
		const lineItems = await controller.getLineItems(ctx.params.id);
		const orderResult = await ctx.context.capabilities.invoke(
			orderCreateCapability,
			{
				customerId: existing.customerId,
				guestEmail: existing.guestEmail ?? ctx.context.session?.user.email,
				currency: existing.currency,
				paymentStatus: "paid",
				subtotal: existing.subtotal,
				taxAmount: existing.taxAmount,
				shippingAmount: existing.shippingAmount,
				discountAmount: existing.discountAmount,
				giftCardAmount: actualGiftCardAmount,
				storeCreditAmount: actualStoreCreditAmount,
				total: adjustedTotal,
				metadata: {
					checkoutSessionId: existing.id,
					paymentIntentId: existing.paymentIntentId,
				},
				items: lineItems.map((item) => ({
					productId: item.productId,
					variantId: item.variantId,
					name: item.name,
					sku: item.sku,
					price: item.price,
					quantity: item.quantity,
				})),
				shippingAddress: existing.shippingAddress
					? {
							firstName: existing.shippingAddress.firstName,
							lastName: existing.shippingAddress.lastName,
							company: existing.shippingAddress.company,
							line1: existing.shippingAddress.line1,
							line2: existing.shippingAddress.line2,
							city: existing.shippingAddress.city,
							state: existing.shippingAddress.state,
							postalCode: existing.shippingAddress.postalCode,
							country: existing.shippingAddress.country,
							phone: existing.shippingAddress.phone,
						}
					: undefined,
				billingAddress: existing.billingAddress
					? {
							firstName: existing.billingAddress.firstName,
							lastName: existing.billingAddress.lastName,
							company: existing.billingAddress.company,
							line1: existing.billingAddress.line1,
							line2: existing.billingAddress.line2,
							city: existing.billingAddress.city,
							state: existing.billingAddress.state,
							postalCode: existing.billingAddress.postalCode,
							country: existing.billingAddress.country,
							phone: existing.billingAddress.phone,
						}
					: undefined,
			},
		);
		if (!orderResult.ok) {
			return {
				code: "CHECKOUT_ORDER_UNAVAILABLE",
				error: "The authoritative Order could not be created.",
				status: 503,
			};
		}
		const orderId = orderResult.decision.orderId;
		const orderNumber = orderResult.decision.orderNumber;

		// Emit order.placed so listeners (e.g. loyalty) can react
		if (ctx.context.events) {
			await ctx.context.events.emit("order.placed", {
				orderId,
				customerId: existing.customerId,
				total: adjustedTotal,
				currency: existing.currency,
			});
		}

		// Increment discount usage now that payment is confirmed and the order exists.
		// This is the canonical point to record redemption — not at apply time (cart
		// abandonment would waste a use) but at completion time when money is collected.
		// applyCode() is best-effort: if the code has since expired or hit its limit,
		// we log the warning but still allow the order through (the amount was already
		// locked in the cart).
		if (existing.discountCode) {
			const discount = await ctx.context.capabilities.invoke(
				discountCodeCapability,
				{
					operation: "commit",
					code: existing.discountCode,
					subtotal: existing.subtotal,
					productIds: lineItems.map((i) => i.productId).filter(Boolean),
				},
			);
			if (!discount.ok || !discount.decision.valid) {
				return {
					code: "CHECKOUT_DISCOUNT_UNAVAILABLE",
					error: "The discount redemption could not be committed.",
					status: 503,
				};
			}
		}

		// Deduct inventory (convert reservations made at confirm time into actual stock deductions)
		if (ctx.context.modules.includes("inventory")) {
			for (const item of lineItems) {
				const deducted = await ctx.context.capabilities.invoke(
					inventoryCheckoutCapability,
					{
						operation: "deduct",
						productId: item.productId,
						...(item.variantId ? { variantId: item.variantId } : {}),
						quantity: item.quantity,
					},
				);
				if (!deducted.ok) {
					return {
						code: "CHECKOUT_INVENTORY_UNAVAILABLE",
						error: "Inventory could not commit the checkout deduction.",
						status: 503,
					};
				}
			}
		}

		const session = await controller.complete(ctx.params.id, orderId);
		if (!session) {
			return { error: "Cannot complete this checkout session", status: 422 };
		}

		// Emit checkout.completed event for email notifications
		if (ctx.context.events) {
			const email = session.guestEmail ?? ctx.context.session?.user.email ?? "";
			const customerName =
				session.shippingAddress?.firstName ??
				ctx.context.session?.user.name ??
				"Customer";

			await ctx.context.events.emit("checkout.completed", {
				sessionId: session.id,
				orderId,
				orderNumber,
				customerId: session.customerId ?? undefined,
				email,
				customerName,
				items: lineItems.map((item) => ({
					name: item.name,
					quantity: item.quantity,
					price: item.price,
					productId: item.productId ?? undefined,
					variantId: item.variantId ?? undefined,
				})),
				subtotal: session.subtotal,
				taxAmount: session.taxAmount,
				shippingAmount: session.shippingAmount,
				discountAmount: session.discountAmount,
				giftCardAmount: actualGiftCardAmount,
				storeCreditAmount: actualStoreCreditAmount,
				total: adjustedTotal,
				currency: session.currency,
				shippingAddress: session.shippingAddress,
			});
		}

		return { session, orderId, orderNumber };
	},
);
