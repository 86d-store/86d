import { addCategoryMapping } from "./add-category-mapping";
import { createFeed } from "./create-feed";
import { deleteCategoryMapping } from "./delete-category-mapping";
import { deleteFeed } from "./delete-feed";
import { generateFeed } from "./generate-feed";
import { getFeed } from "./get-feed";
import { getFeedItems } from "./get-feed-items";
import { getStats } from "./get-stats";
import { listCategoryMappings } from "./list-category-mappings";
import { listFeeds } from "./list-feeds";
import { updateFeed } from "./update-feed";
import { validateFeed } from "./validate-feed";

export const adminEndpoints = {
	"/admin/product-feeds": listFeeds,
	"/admin/product-feeds/stats": getStats,
	"/admin/product-feeds/create": createFeed,
	"/admin/product-feeds/:id": getFeed,
	"/admin/product-feeds/:id/update": updateFeed,
	"/admin/product-feeds/:id/delete": deleteFeed,
	"/admin/product-feeds/:id/generate": generateFeed,
	"/admin/product-feeds/:id/items": getFeedItems,
	"/admin/product-feeds/:id/validate": validateFeed,
	"/admin/product-feeds/:id/mappings": listCategoryMappings,
	"/admin/product-feeds/:id/mappings/create": addCategoryMapping,
	"/admin/product-feeds/:id/mappings/:mappingId/delete": deleteCategoryMapping,
};
