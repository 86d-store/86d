import { getFulfillment } from "./get-fulfillment";
import { listByOrder } from "./list-by-order";

export const storeEndpoints = {
	"/fulfillment/:id": getFulfillment,
	"/fulfillment/order/:orderId": listByOrder,
};
