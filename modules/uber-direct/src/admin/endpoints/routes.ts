import { createServiceAreaEndpoint } from "./create-service-area";
import { deleteServiceAreaEndpoint } from "./delete-service-area";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listDeliveries } from "./list-deliveries";
import { listQuotes } from "./list-quotes";
import { listServiceAreasEndpoint } from "./list-service-areas";
import { getDeliveryStats } from "./stats";
import { updateDeliveryStatus } from "./update-delivery-status";
import { updateServiceAreaEndpoint } from "./update-service-area";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		"/admin/uber-direct/deliveries": listDeliveries,
		"/admin/uber-direct/deliveries/:id/status": updateDeliveryStatus,
		"/admin/uber-direct/quotes": listQuotes,
		"/admin/uber-direct/stats": getDeliveryStats,
		"/admin/uber-direct/settings": settingsEndpoint,
		"/admin/uber-direct/service-areas": listServiceAreasEndpoint,
		"/admin/uber-direct/service-areas/create": createServiceAreaEndpoint,
		"/admin/uber-direct/service-areas/:id": updateServiceAreaEndpoint,
		"/admin/uber-direct/service-areas/:id/delete": deleteServiceAreaEndpoint,
	};
}
