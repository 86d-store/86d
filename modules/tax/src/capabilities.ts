import { provideCapability } from "@86d-app/core/capabilities";
import { taxQuoteCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "@86d-app/core/zod";
import type { TaxController } from "./service";
import { createTaxController } from "./service-impl";

export { taxQuoteCapability };

type TaxQuoteRequest = z.infer<typeof taxQuoteCapability.request>;

export async function handleTaxQuote(
	controller: TaxController,
	request: TaxQuoteRequest,
) {
	try {
		const calculation = await controller.calculate(request);
		// A zero that means "no rate was configured" is not a decision to charge
		// nothing. Selling on it would undercharge every shopper in that
		// jurisdiction silently, so the quote becomes review instead.
		if (
			calculation.shippingUnresolved ||
			calculation.lines.some((line) => line.unresolved)
		) {
			return {
				ok: false as const,
				failure: {
					code: "TAX_REVIEW_REQUIRED" as const,
					message: "No tax rate is configured for this address.",
				},
			};
		}
		return {
			ok: true as const,
			decision: {
				totalTax: calculation.totalTax,
				shippingTax: calculation.shippingTax,
				lineItems: calculation.lines.map((line) => ({
					productId: line.productId,
					taxableAmount: line.taxableAmount,
					taxAmount: line.taxAmount,
					rate: line.rate,
				})),
			},
		};
	} catch {
		return {
			ok: false as const,
			failure: {
				code: "TAX_REVIEW_REQUIRED" as const,
				message: "An authoritative tax decision is unavailable.",
			},
		};
	}
}

export function createTaxQuoteProvider(options?: {
	taxjarApiKey?: string | undefined;
	taxjarSandbox?: boolean | undefined;
}) {
	return provideCapability(taxQuoteCapability, async (ctx, request) =>
		handleTaxQuote(createTaxController(ctx.data, ctx.events, options), request),
	);
}
