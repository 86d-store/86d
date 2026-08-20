import { campaignStatsEndpoint } from "./campaign-stats";
import { createCampaignEndpoint } from "./create-campaign";
import { deleteCampaignEndpoint } from "./delete-campaign";
import { deleteSubscriberEndpoint } from "./delete-subscriber";
import { listCampaignsEndpoint } from "./list-campaigns";
import { listSubscribersEndpoint } from "./list-subscribers";
import { sendCampaignEndpoint } from "./send-campaign";
import { updateCampaignEndpoint } from "./update-campaign";

export const adminEndpoints = {
	"/admin/newsletter": listSubscribersEndpoint,
	"/admin/newsletter/:id/delete": deleteSubscriberEndpoint,
	"/admin/newsletter/campaigns": listCampaignsEndpoint,
	"/admin/newsletter/campaigns/create": createCampaignEndpoint,
	"/admin/newsletter/campaigns/stats": campaignStatsEndpoint,
	"/admin/newsletter/campaigns/:id": updateCampaignEndpoint,
	"/admin/newsletter/campaigns/:id/delete": deleteCampaignEndpoint,
	"/admin/newsletter/campaigns/:id/send": sendCampaignEndpoint,
};
