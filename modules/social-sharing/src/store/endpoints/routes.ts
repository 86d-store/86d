import { countEndpoint } from "./count";
import { shareEndpoint } from "./share";
import { urlEndpoint } from "./url";

export const storeEndpoints = {
	"/social-sharing/share": shareEndpoint,
	"/social-sharing/count": countEndpoint,
	"/social-sharing/url": urlEndpoint,
};
