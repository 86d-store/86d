import { featuredPostsEndpoint } from "./featured-posts";
import { getPostEndpoint } from "./get-post";
import { listPostsEndpoint } from "./list-posts";
import { relatedPostsEndpoint } from "./related-posts";
import { searchPostsEndpoint } from "./search-posts";
import { trackViewEndpoint } from "./track-view";

export const storeEndpoints = {
	"/blog": listPostsEndpoint,
	"/blog/featured": featuredPostsEndpoint,
	"/blog/search": searchPostsEndpoint,
	"/blog/:slug": getPostEndpoint,
	"/blog/:slug/related": relatedPostsEndpoint,
	"/blog/:slug/view": trackViewEndpoint,
};
