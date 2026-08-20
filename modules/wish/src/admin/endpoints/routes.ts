import { createProductEndpoint } from "./create-product";
import { disableProductEndpoint } from "./disable-product";
import { getProductEndpoint } from "./get-product";
import { listOrdersEndpoint } from "./list-orders";
import { listProductsEndpoint } from "./list-products";
import { pendingShipmentsEndpoint } from "./pending-shipments";
import { shipOrderEndpoint } from "./ship-order";
import { statsEndpoint } from "./stats";
import { updateProductEndpoint } from "./update-product";

export const adminEndpoints = {
	"/admin/wish/products": listProductsEndpoint,
	"/admin/wish/products/create": createProductEndpoint,
	"/admin/wish/products/:id": getProductEndpoint,
	"/admin/wish/products/:id/update": updateProductEndpoint,
	"/admin/wish/products/:id/disable": disableProductEndpoint,
	"/admin/wish/orders": listOrdersEndpoint,
	"/admin/wish/orders/pending": pendingShipmentsEndpoint,
	"/admin/wish/orders/:id/ship": shipOrderEndpoint,
	"/admin/wish/stats": statsEndpoint,
};
