import { deleteSettingEndpoint } from "./delete-setting";
import { getSettingEndpoint } from "./get-setting";
import { getSettingsEndpoint } from "./get-settings";
import { updateBulkEndpoint } from "./update-bulk";
import { updateSettingEndpoint } from "./update-setting";

export const adminEndpoints = {
	"/admin/settings": getSettingsEndpoint,
	"/admin/settings/update": updateSettingEndpoint,
	"/admin/settings/update-bulk": updateBulkEndpoint,
	"/admin/settings/:key": getSettingEndpoint,
	"/admin/settings/:key/delete": deleteSettingEndpoint,
};
