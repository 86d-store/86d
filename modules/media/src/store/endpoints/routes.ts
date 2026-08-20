import { getAssetEndpoint } from "./get-asset";
import { listAssetsEndpoint } from "./list-assets";

export const storeEndpoints = {
	"/media": listAssetsEndpoint,
	"/media/:id": getAssetEndpoint,
};
