import { createItemEndpoint } from "./create-item";
import { createMenuEndpoint } from "./create-menu";
import { deleteItemEndpoint } from "./delete-item";
import { deleteMenuEndpoint } from "./delete-menu";
import { adminGetMenuEndpoint } from "./get-menu";
import { adminListMenusEndpoint } from "./list-menus";
import { reorderItemsEndpoint } from "./reorder-items";
import { updateItemEndpoint } from "./update-item";
import { updateMenuEndpoint } from "./update-menu";

export const adminEndpoints = {
	"/admin/navigation/menus": adminListMenusEndpoint,
	"/admin/navigation/menus/create": createMenuEndpoint,
	"/admin/navigation/menus/:id": adminGetMenuEndpoint,
	"/admin/navigation/menus/:id/update": updateMenuEndpoint,
	"/admin/navigation/menus/:id/delete": deleteMenuEndpoint,
	"/admin/navigation/menus/:menuId/reorder": reorderItemsEndpoint,
	"/admin/navigation/items/create": createItemEndpoint,
	"/admin/navigation/items/:id/update": updateItemEndpoint,
	"/admin/navigation/items/:id/delete": deleteItemEndpoint,
};
