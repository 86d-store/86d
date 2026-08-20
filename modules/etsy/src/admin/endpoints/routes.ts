import { averageRatingEndpoint } from "./average-rating";
import { createListingEndpoint } from "./create-listing";
import { deleteListingEndpoint } from "./delete-listing";
import { expiringListingsEndpoint } from "./expiring-listings";
import { getListingEndpoint } from "./get-listing";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listListingsEndpoint } from "./list-listings";
import { listOrdersEndpoint } from "./list-orders";
import { listReviewsEndpoint } from "./list-reviews";
import { renewListingEndpoint } from "./renew-listing";
import { shipOrderEndpoint } from "./ship-order";
import { statsEndpoint } from "./stats";
import { updateListingEndpoint } from "./update-listing";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/etsy/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/etsy/listings": listListingsEndpoint,
	"/admin/etsy/listings/create": createListingEndpoint,
	"/admin/etsy/listings/expiring": expiringListingsEndpoint,
	"/admin/etsy/listings/:id": getListingEndpoint,
	"/admin/etsy/listings/:id/update": updateListingEndpoint,
	"/admin/etsy/listings/:id/delete": deleteListingEndpoint,
	"/admin/etsy/listings/:id/renew": renewListingEndpoint,
	"/admin/etsy/orders": listOrdersEndpoint,
	"/admin/etsy/orders/:id/ship": shipOrderEndpoint,
	"/admin/etsy/reviews": listReviewsEndpoint,
	"/admin/etsy/reviews/average": averageRatingEndpoint,
	"/admin/etsy/stats": statsEndpoint,
};
