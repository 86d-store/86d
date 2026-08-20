import { getProductDeal } from "./get-product-deal";
import { getProductDeals } from "./get-product-deals";
import { getSale } from "./get-sale";
import { listActive } from "./list-active";

export const storeEndpoints = {
	"/flash-sales": listActive,
	"/flash-sales/:slug": getSale,
	"/flash-sales/product/:productId": getProductDeal,
	"/flash-sales/products": getProductDeals,
};
