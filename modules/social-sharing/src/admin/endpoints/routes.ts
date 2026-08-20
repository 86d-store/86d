import { getSettingsEndpoint } from "./get-settings";
import { listSharesEndpoint } from "./list-shares";
import { statsEndpoint } from "./stats";
import { topEndpoint } from "./top";
import { updateSettingsEndpoint } from "./update-settings";

export const adminEndpoints = {
	"/admin/social-sharing": listSharesEndpoint,
	"/admin/social-sharing/stats": statsEndpoint,
	"/admin/social-sharing/top": topEndpoint,
	"/admin/social-sharing/settings": getSettingsEndpoint,
	"/admin/social-sharing/settings/update": updateSettingsEndpoint,
};
