import { provideCapability } from "@86d-app/core/capabilities";
import { giftCardCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "zod";
import type { GiftCardController } from "./service";
import { createGiftCardController } from "./service-impl";

type GiftCardCheckoutRequest = z.infer<
	typeof giftCardCheckoutCapability.request
>;

export async function handleGiftCardCheckout(
	controller: GiftCardController,
	request: GiftCardCheckoutRequest,
) {
	if (request.operation === "balance") {
		const balance = await controller.checkBalance(request.code);
		return balance
			? {
					ok: true as const,
					decision: { operation: "balance" as const, ...balance },
				}
			: {
					ok: false as const,
					failure: {
						code: "GIFT_CARD_NOT_FOUND" as const,
						message: "Gift card not found.",
					},
				};
	}
	const result = await controller.redeem(
		request.code,
		request.amount,
		request.orderId,
	);
	return result
		? {
				ok: true as const,
				decision: {
					operation: "redeem" as const,
					transactionId: result.transaction.id,
					amount: result.transaction.amount,
					balanceAfter: result.transaction.balanceAfter,
				},
			}
		: {
				ok: false as const,
				failure: {
					code: "GIFT_CARD_REDEMPTION_FAILED" as const,
					message: "Gift card could not be redeemed.",
				},
			};
}

export const giftCardCheckoutProvider = provideCapability(
	giftCardCheckoutCapability,
	async (ctx, request) =>
		handleGiftCardCheckout(
			createGiftCardController(ctx.data, ctx.transactions),
			request,
		),
);
