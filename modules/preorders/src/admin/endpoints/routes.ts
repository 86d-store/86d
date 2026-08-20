import { activateCampaign } from "./activate-campaign";
import { cancelCampaign } from "./cancel-campaign";
import { cancelItem } from "./cancel-item";
import { completeCampaign } from "./complete-campaign";
import { createCampaign } from "./create-campaign";
import { fulfillItem } from "./fulfill-item";
import { getCampaignAdmin } from "./get-campaign";
import { listCampaignsAdmin } from "./list-campaigns";
import { listItems } from "./list-items";
import { markReady } from "./mark-ready";
import { notifyCustomers } from "./notify-customers";
import { pauseCampaign } from "./pause-campaign";
import { preorderSummary } from "./preorder-summary";
import { updateCampaign } from "./update-campaign";

export const adminEndpoints = {
	"/admin/preorders/campaigns": listCampaignsAdmin,
	"/admin/preorders/campaigns/create": createCampaign,
	"/admin/preorders/campaigns/:id": getCampaignAdmin,
	"/admin/preorders/campaigns/:id/update": updateCampaign,
	"/admin/preorders/campaigns/:id/activate": activateCampaign,
	"/admin/preorders/campaigns/:id/pause": pauseCampaign,
	"/admin/preorders/campaigns/:id/complete": completeCampaign,
	"/admin/preorders/campaigns/:id/cancel": cancelCampaign,
	"/admin/preorders/campaigns/:id/notify": notifyCustomers,
	"/admin/preorders/items": listItems,
	"/admin/preorders/items/:id/fulfill": fulfillItem,
	"/admin/preorders/items/:id/ready": markReady,
	"/admin/preorders/items/:id/cancel": cancelItem,
	"/admin/preorders/summary": preorderSummary,
};
