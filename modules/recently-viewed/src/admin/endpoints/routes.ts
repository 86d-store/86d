import { customerViews } from "./customer-views";
import { deleteView } from "./delete-view";
import { listAllViews } from "./list-views";
import { popularProducts } from "./popular-products";

export const adminEndpoints = {
	"/admin/recently-viewed": listAllViews,
	"/admin/recently-viewed/popular": popularProducts,
	"/admin/recently-viewed/customer/:id": customerViews,
	"/admin/recently-viewed/:id/delete": deleteView,
};
