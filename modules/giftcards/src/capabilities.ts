import { provideCapability } from "@86d-app/core/capabilities";
import { giftCardCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "zod";
import type { GiftCardController } from "./service";
import { createGiftCardController } from "./service-impl";

type GiftCardCheckoutRequest = z.infer<
	typeof giftCardCheckoutCapability.request
>;

export async function handleGiftCardCheckout(
	_controller: GiftCardController,
	request: GiftCardCheckoutRequest,
) {
	return {
		ok: false as const,
		failure: {
			code: "GIFT_CARD_REDEMPTION_FAILED" as const,
			message:
				request.operation === "balance"
					? "Gift card checkout application is unavailable."
					: "Gift card redemption is unavailable.",
		},
	};
}

export const giftCardCheckoutProvider = provideCapability(
	giftCardCheckoutCapability,
	async (ctx, request) =>
		handleGiftCardCheckout(createGiftCardController(ctx.data), request),
);
