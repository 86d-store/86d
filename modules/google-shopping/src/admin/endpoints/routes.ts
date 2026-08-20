import { createFeedItemEndpoint } from "./create-feed-item";
import { deleteFeedItemEndpoint } from "./delete-feed-item";
import { diagnosticsEndpoint } from "./diagnostics";
import { getFeedItemEndpoint } from "./get-feed-item";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listFeedItemsEndpoint } from "./list-feed-items";
import { listOrdersEndpoint } from "./list-orders";
import { listSubmissionsEndpoint } from "./list-submissions";
import { statsEndpoint } from "./stats";
import { submitFeedEndpoint } from "./submit-feed";
import { updateFeedItemEndpoint } from "./update-feed-item";
import { updateOrderStatusEndpoint } from "./update-order-status";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/google-shopping/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/google-shopping/feed-items": listFeedItemsEndpoint,
	"/admin/google-shopping/feed-items/create": createFeedItemEndpoint,
	"/admin/google-shopping/feed-items/:id": getFeedItemEndpoint,
	"/admin/google-shopping/feed-items/:id/update": updateFeedItemEndpoint,
	"/admin/google-shopping/feed-items/:id/delete": deleteFeedItemEndpoint,
	"/admin/google-shopping/submit": submitFeedEndpoint,
	"/admin/google-shopping/submissions": listSubmissionsEndpoint,
	"/admin/google-shopping/orders": listOrdersEndpoint,
	"/admin/google-shopping/orders/:id/status": updateOrderStatusEndpoint,
	"/admin/google-shopping/stats": statsEndpoint,
	"/admin/google-shopping/diagnostics": diagnosticsEndpoint,
};
