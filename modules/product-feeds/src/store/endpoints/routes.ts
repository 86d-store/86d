import { getFeedBySlug } from "./get-feed-by-slug";
import { listActiveFeeds } from "./list-active-feeds";

export const storeEndpoints = {
	"/feeds": listActiveFeeds,
	"/feeds/:slug": getFeedBySlug,
};
