import type { createGetSettingsEndpoint } from "./get-settings";
import { listMenuSyncsEndpoint } from "./list-menu-syncs";
import { listOrdersEndpoint } from "./list-orders";
import { orderStatsEndpoint } from "./order-stats";
import { syncMenuAdminEndpoint } from "./sync-menu";

export const adminEndpoints = {
	"/admin/uber-eats/orders": listOrdersEndpoint,
	"/admin/uber-eats/stats": orderStatsEndpoint,
	"/admin/uber-eats/menu-syncs": listMenuSyncsEndpoint,
	"/admin/uber-eats/menu-syncs/create": syncMenuAdminEndpoint,
};

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/uber-eats/settings": settingsEndpoint,
	};
}
