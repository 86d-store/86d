import { getProductActivity } from "./get-product-activity";
import { getRecentActivity } from "./get-recent-activity";
import { getTrending } from "./get-trending";
import { listBadges } from "./list-badges";
import { trackEvent } from "./track-event";

export const storeEndpoints = {
	"/social-proof/track": trackEvent,
	"/social-proof/activity/:productId": getProductActivity,
	"/social-proof/trending": getTrending,
	"/social-proof/badges": listBadges,
	"/social-proof/recent": getRecentActivity,
};
