import { deleteSettingEndpoint } from "./delete-setting";
import { getCheckoutSettingsEndpoint } from "./get-checkout-settings";
import { getCommerceSettingsEndpoint } from "./get-commerce-settings";
import { getPickupSettingsEndpoint } from "./get-pickup-settings";
import { getSettingEndpoint } from "./get-setting";
import { getSettingsEndpoint } from "./get-settings";
import { updateBulkEndpoint } from "./update-bulk";
import { updateCheckoutSettingsEndpoint } from "./update-checkout-settings";
import { updateCommerceSettingsEndpoint } from "./update-commerce-settings";
import { updatePickupSettingsEndpoint } from "./update-pickup-settings";
import { updateSettingEndpoint } from "./update-setting";

export const adminEndpoints = {
	"/admin/settings": getSettingsEndpoint,
	"/admin/settings/update": updateSettingEndpoint,
	"/admin/settings/update-bulk": updateBulkEndpoint,
	"/admin/settings/checkout": getCheckoutSettingsEndpoint,
	"/admin/settings/checkout/update": updateCheckoutSettingsEndpoint,
	"/admin/settings/commerce": getCommerceSettingsEndpoint,
	"/admin/settings/commerce/update": updateCommerceSettingsEndpoint,
	"/admin/settings/pickup": getPickupSettingsEndpoint,
	"/admin/settings/pickup/update": updatePickupSettingsEndpoint,
	"/admin/settings/:key": getSettingEndpoint,
	"/admin/settings/:key/delete": deleteSettingEndpoint,
};
