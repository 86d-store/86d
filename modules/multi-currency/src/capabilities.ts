import { provideCapability } from "@86d-app/core/capabilities";
import { productPriceConversionCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "./service";
import { createMultiCurrencyController } from "./service-impl";

export { productPriceConversionCapability };

type ProductPriceConversionRequest = z.infer<
	typeof productPriceConversionCapability.request
>;

export async function handleProductPriceConversion(
	controller: MultiCurrencyController,
	request: ProductPriceConversionRequest,
) {
	const result = await controller.getProductPrice(request);
	return result
		? { ok: true as const, decision: { amount: result.amount } }
		: {
				ok: false as const,
				failure: {
					code: "CURRENCY_UNAVAILABLE" as const,
					message: "Authoritative currency conversion is unavailable.",
				},
			};
}

export const productPriceConversionProvider = provideCapability(
	productPriceConversionCapability,
	async (ctx, request) =>
		handleProductPriceConversion(
			createMultiCurrencyController(ctx.data, ctx.events),
			request,
		),
);
