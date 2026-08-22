import { provideCapability } from "@86d-app/core/capabilities";
import { shippingQuoteCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "zod";
import type { ShippingController } from "./service";
import { createShippingController } from "./service-impl";

type ShippingQuoteRequest = z.infer<typeof shippingQuoteCapability.request>;

export async function handleShippingQuote(
	controller: ShippingController,
	request: ShippingQuoteRequest,
) {
	const rates = await controller.calculateRates(request);
	if (rates.length === 0) {
		return {
			ok: false as const,
			failure: {
				code: "NO_SHIPPING_OPTION" as const,
				message: "No authoritative shipping option is available.",
			},
		};
	}
	return { ok: true as const, decision: { rates } };
}

export function createShippingQuoteProvider(options?: {
	easypostApiKey?: string | undefined;
	easypostTestMode?: boolean | undefined;
}) {
	return provideCapability(shippingQuoteCapability, async (ctx, request) =>
		handleShippingQuote(
			createShippingController(ctx.data, ctx.events, options),
			request,
		),
	);
}
