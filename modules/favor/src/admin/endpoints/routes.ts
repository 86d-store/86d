import { createServiceArea } from "./create-service-area";
import { createGetSettingsEndpoint } from "./get-settings";
import { listDeliveries } from "./list-deliveries";
import { listServiceAreas } from "./list-service-areas";
import { getFavorStats } from "./stats";
import { updateDeliveryStatus } from "./update-delivery-status";

export function createAdminEndpoints(options: {
	apiKey?: string | undefined;
	merchantId?: string | undefined;
	sandbox?: boolean | undefined;
}) {
	return {
		"/admin/favor/settings": createGetSettingsEndpoint(options),
		"/admin/favor/deliveries": listDeliveries,
		"/admin/favor/deliveries/:id/status": updateDeliveryStatus,
		"/admin/favor/service-areas": listServiceAreas,
		"/admin/favor/service-areas/create": createServiceArea,
		"/admin/favor/stats": getFavorStats,
	};
}

export const adminEndpoints = createAdminEndpoints({});
