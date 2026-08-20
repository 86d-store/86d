import { checkRedirect } from "./check";
import { resolveRedirect } from "./resolve";

export const storeEndpoints = {
	"/redirects/resolve": resolveRedirect,
	"/redirects/check": checkRedirect,
};
