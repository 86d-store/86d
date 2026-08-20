import { subscribeEndpoint } from "./subscribe";
import { unsubscribeEndpoint } from "./unsubscribe";

export const storeEndpoints = {
	"/newsletter/subscribe": subscribeEndpoint,
	"/newsletter/unsubscribe": unsubscribeEndpoint,
};
