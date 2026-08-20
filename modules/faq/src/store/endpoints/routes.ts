import { getCategory } from "./get-category";
import { getItem } from "./get-item";
import { listCategories } from "./list-categories";
import { searchFaqs } from "./search";
import { voteFaq } from "./vote";

export const storeEndpoints = {
	"/faq/categories": listCategories,
	"/faq/categories/:slug": getCategory,
	"/faq/items/:slug": getItem,
	"/faq/search": searchFaqs,
	"/faq/items/:id/vote": voteFaq,
};
