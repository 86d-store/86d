import { itemWrapping } from "./item-wrapping";
import { listOptions } from "./list-options";
import { orderWrapping } from "./order-wrapping";
import { removeWrapping } from "./remove-wrapping";
import { selectWrapping } from "./select-wrapping";

export const storeEndpoints = {
	"/gift-wrapping/options": listOptions,
	"/gift-wrapping/select": selectWrapping,
	"/gift-wrapping/remove": removeWrapping,
	"/gift-wrapping/order/:orderId": orderWrapping,
	"/gift-wrapping/item/:orderItemId": itemWrapping,
};
