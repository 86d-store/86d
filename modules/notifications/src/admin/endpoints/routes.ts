import { batchSendEndpoint } from "./batch-send";
import { bulkDeleteEndpoint } from "./bulk-delete";
import { createNotificationEndpoint } from "./create-notification";
import { createTemplateEndpoint } from "./create-template";
import { deleteCustomerPreferencesEndpoint } from "./delete-customer-preferences";
import { deleteNotificationEndpoint } from "./delete-notification";
import { deleteTemplateEndpoint } from "./delete-template";
import { getCustomerPreferencesEndpoint } from "./get-customer-preferences";
import { getNotificationEndpoint } from "./get-notification";
import type { createGetSettingsEndpoint } from "./get-settings";
import { getTemplateEndpoint } from "./get-template";
import { listNotificationsEndpoint } from "./list-notifications";
import { listPreferencesEndpoint } from "./list-preferences";
import { listTemplatesEndpoint } from "./list-templates";
import { sendFromTemplateEndpoint } from "./send-from-template";
import { statsEndpoint } from "./stats";
import { updateCustomerPreferencesEndpoint } from "./update-customer-preferences";
import { updateNotificationEndpoint } from "./update-notification";
import { updateTemplateEndpoint } from "./update-template";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/notifications/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/notifications": listNotificationsEndpoint,
	"/admin/notifications/create": createNotificationEndpoint,
	"/admin/notifications/stats": statsEndpoint,
	"/admin/notifications/bulk-delete": bulkDeleteEndpoint,
	"/admin/notifications/batch-send": batchSendEndpoint,
	"/admin/notifications/preferences": listPreferencesEndpoint,
	"/admin/notifications/preferences/:customerId":
		getCustomerPreferencesEndpoint,
	"/admin/notifications/preferences/:customerId/update":
		updateCustomerPreferencesEndpoint,
	"/admin/notifications/preferences/:customerId/delete":
		deleteCustomerPreferencesEndpoint,
	"/admin/notifications/templates": listTemplatesEndpoint,
	"/admin/notifications/templates/create": createTemplateEndpoint,
	"/admin/notifications/templates/send": sendFromTemplateEndpoint,
	"/admin/notifications/templates/:id": getTemplateEndpoint,
	"/admin/notifications/templates/:id/update": updateTemplateEndpoint,
	"/admin/notifications/templates/:id/delete": deleteTemplateEndpoint,
	"/admin/notifications/:id": getNotificationEndpoint,
	"/admin/notifications/:id/update": updateNotificationEndpoint,
	"/admin/notifications/:id/delete": deleteNotificationEndpoint,
};
