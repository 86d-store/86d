import { provideCapability } from "@86d-app/core/capabilities";
import { priceListResolveCapability } from "@86d-app/core/commerce-capabilities";
import type { z } from "zod";
import type { PriceListController } from "./service";
import { createPriceListController } from "./service-impl";

type PriceListResolveRequest = z.infer<
	typeof priceListResolveCapability.request
>;

export async function handlePriceListResolve(
	controller: PriceListController,
	request: PriceListResolveRequest,
) {
	try {
		const resolved = await controller.resolvePrices(request.productIds, {
			...(request.customerGroupId
				? { customerGroupId: request.customerGroupId }
				: {}),
			...(request.quantity ? { quantity: request.quantity } : {}),
			...(request.currency ? { currency: request.currency } : {}),
		});
		return {
			ok: true as const,
			decision: {
				prices: Object.fromEntries(
					Object.entries(resolved).map(([productId, price]) => [
						productId,
						{
							price: price.price,
							compareAtPrice: price.compareAtPrice,
						},
					]),
				),
			},
		};
	} catch {
		return {
			ok: false as const,
			failure: {
				code: "PRICE_LIST_RESOLUTION_FAILED" as const,
				message: "Authoritative price-list resolution is unavailable.",
			},
		};
	}
}

export const priceListResolveProvider = provideCapability(
	priceListResolveCapability,
	async (ctx, request) =>
		handlePriceListResolve(createPriceListController(ctx.data), request),
);
