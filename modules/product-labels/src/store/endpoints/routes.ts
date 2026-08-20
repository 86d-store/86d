import { getLabel } from "./get-label";
import { getProductLabels } from "./get-product-labels";
import { listLabels } from "./list-labels";

export const storeEndpoints = {
	"/product-labels": listLabels,
	"/product-labels/:slug": getLabel,
	"/product-labels/products/:productId": getProductLabels,
};
