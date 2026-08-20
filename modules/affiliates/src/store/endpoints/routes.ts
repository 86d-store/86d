import { applyEndpoint } from "./apply";
import { createLinkEndpoint } from "./create-link";
import { myDashboardEndpoint } from "./my-dashboard";
import { myLinksEndpoint } from "./my-links";
import { trackClickEndpoint } from "./track-click";

export const storeEndpoints = {
	"/affiliates/apply": applyEndpoint,
	"/affiliates/dashboard": myDashboardEndpoint,
	"/affiliates/my-links": myLinksEndpoint,
	"/affiliates/links/create": createLinkEndpoint,
	"/affiliates/track": trackClickEndpoint,
};
