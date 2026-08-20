import { getMetaEndpoint } from "./get-meta";
import { getRedirectEndpoint } from "./get-redirect";
import { getSitemapEndpoint } from "./get-sitemap";

export const storeEndpoints = {
	"/seo/meta": getMetaEndpoint,
	"/seo/redirect": getRedirectEndpoint,
	"/seo/sitemap": getSitemapEndpoint,
};
