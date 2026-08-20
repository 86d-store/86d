import { backInStockCheck } from "./back-in-stock-check";
import { backInStockSubscribe } from "./back-in-stock-subscribe";
import { backInStockUnsubscribe } from "./back-in-stock-unsubscribe";
import { checkStock } from "./check-stock";

export const storeEndpoints = {
	"/inventory/check": checkStock,
	"/inventory/back-in-stock/subscribe": backInStockSubscribe,
	"/inventory/back-in-stock/unsubscribe": backInStockUnsubscribe,
	"/inventory/back-in-stock/check": backInStockCheck,
};
