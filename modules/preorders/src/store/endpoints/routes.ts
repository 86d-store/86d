import { cancelPreorder } from "./cancel-preorder";
import { checkAvailability } from "./check-availability";
import { getCampaign } from "./get-campaign";
import { listCampaigns } from "./list-campaigns";
import { myPreorders } from "./my-preorders";
import { placePreorder } from "./place-preorder";

export const storeEndpoints = {
	"/preorders/campaigns": listCampaigns,
	"/preorders/campaigns/:id": getCampaign,
	"/preorders/check/:productId": checkAvailability,
	"/preorders/place": placePreorder,
	"/preorders/mine": myPreorders,
	"/preorders/:id/cancel": cancelPreorder,
};
