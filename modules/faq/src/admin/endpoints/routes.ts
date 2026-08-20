import { createCategory } from "./create-category";
import { createItem } from "./create-item";
import { deleteCategory } from "./delete-category";
import { deleteItem } from "./delete-item";
import { getItem } from "./get-item";
import { listCategories } from "./list-categories";
import { listItems } from "./list-items";
import { getStats } from "./stats";
import { updateCategory } from "./update-category";
import { updateItem } from "./update-item";

export const adminEndpoints = {
	"/admin/faq/categories": listCategories,
	"/admin/faq/categories/create": createCategory,
	"/admin/faq/categories/:id": updateCategory,
	"/admin/faq/categories/:id/delete": deleteCategory,
	"/admin/faq/items": listItems,
	"/admin/faq/items/create": createItem,
	"/admin/faq/items/:id": getItem,
	"/admin/faq/items/:id/update": updateItem,
	"/admin/faq/items/:id/delete": deleteItem,
	"/admin/faq/stats": getStats,
};
