import { productTiers } from "./product-tiers";
import { resolvePrice } from "./resolve-price";

export const storeEndpoints = {
	"/bulk-pricing/resolve": resolvePrice,
	"/bulk-pricing/product/:productId/tiers": productTiers,
};
