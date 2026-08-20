import { recentlyViewedEndpoint } from "./recently-viewed";
import { trackEventEndpoint } from "./track-event";

export const storeEndpoints = {
	"/analytics/events": trackEventEndpoint,
	"/analytics/recently-viewed": recentlyViewedEndpoint,
};
