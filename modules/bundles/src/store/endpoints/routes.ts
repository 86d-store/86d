import { getBundle } from "./get-bundle";
import { listActiveBundles } from "./list-active-bundles";

export const storeEndpoints = {
	"/bundles": listActiveBundles,
	"/bundles/:slug": getBundle,
};
