import { getPriceList } from "./get-price-list";
import { resolvePrice } from "./resolve-price";
import { resolvePrices } from "./resolve-prices";

export const storeEndpoints = {
	"/price-lists/:slug": getPriceList,
	"/prices/product/:productId": resolvePrice,
	"/prices/products": resolvePrices,
};
