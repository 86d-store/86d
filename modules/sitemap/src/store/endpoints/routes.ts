import { getSitemap } from "./get-sitemap";
import { getSitemapIndex, getSitemapPage } from "./get-sitemap-index";
import { getPublicStats } from "./get-stats";

export const storeEndpoints = {
	"/sitemap.xml": getSitemap,
	"/sitemap-index.xml": getSitemapIndex,
	"/sitemap-page.xml": getSitemapPage,
	"/sitemap/stats": getPublicStats,
};
