import { cancelMyOrder } from "./cancel-order";
import { claimGuestOrder } from "./claim-guest-order";
import { confirmOrder } from "./confirm-order";
import { createMyReturn } from "./create-return";
import {
	getMyOrderReturnsUnavailable as getMyOrderReturns,
	listMyReturnsUnavailable as listMyReturns,
} from "./customer-continuity-unavailable";
import { getMyOrderFulfillments } from "./get-fulfillments";
import { getMyInvoice } from "./get-invoice";
import { getMyOrder } from "./get-order";
import { listMyOrders } from "./list-orders";
import { reorder } from "./reorder";
import { storeSearch } from "./store-search";
import { trackOrder } from "./track-order";

export const storeEndpoints = {
	"/orders/store-search": storeSearch,
	"/orders/track": trackOrder,
	"/orders/confirm": confirmOrder,
	"/orders/claim": claimGuestOrder,
	"/orders/me": listMyOrders,
	"/orders/me/returns": listMyReturns,
	"/orders/me/:id": getMyOrder,
	"/orders/me/:id/cancel": cancelMyOrder,
	"/orders/me/:id/invoice": getMyInvoice,
	"/orders/me/:id/reorder": reorder,
	"/orders/me/:id/fulfillments": getMyOrderFulfillments,
	"/orders/me/:id/returns": getMyOrderReturns,
	"/orders/me/:id/returns/create": createMyReturn,
};
