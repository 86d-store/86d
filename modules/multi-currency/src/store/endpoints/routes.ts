import { convertPrice } from "./convert-price";
import { getProductPrice } from "./get-product-price";
import { listCurrencies } from "./list-currencies";

export const storeEndpoints = {
	"/currencies": listCurrencies,
	"/currencies/convert": convertPrice,
	"/currencies/product-price": getProductPrice,
};
