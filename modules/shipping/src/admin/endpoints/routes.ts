import { addRate } from "./add-rate";
import { createCarrier } from "./create-carrier";
import { createMethod } from "./create-method";
import { createZone } from "./create-zone";
import { deleteCarrier } from "./delete-carrier";
import { deleteMethod } from "./delete-method";
import { deleteRate } from "./delete-rate";
import { deleteZone } from "./delete-zone";
import { createGetConnectionEndpoint } from "./get-connection";
import type { createGetSettingsEndpoint } from "./get-settings";
import { getShipment } from "./get-shipment";
import { listCarriers } from "./list-carriers";
import { listMethods } from "./list-methods";
import { listRates } from "./list-rates";
import { listShipments } from "./list-shipments";
import { listZones } from "./list-zones";
import {
	createShipmentUnavailable as createShipment,
	deleteShipmentUnavailable as deleteShipment,
	updateShipmentUnavailable as updateShipment,
	updateShipmentStatusUnavailable as updateShipmentStatus,
} from "./shipment-activation-unavailable";
import { updateCarrier } from "./update-carrier";
import {
	createUpdateConnectionOriginEndpoint,
	type UpdateConnectionOriginOptions,
} from "./update-connection-origin";
import { updateMethod } from "./update-method";
import { updateRate } from "./update-rate";
import { updateZone } from "./update-zone";

export interface AdminConnectionOptions extends UpdateConnectionOriginOptions {}

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
	connectionOptions: AdminConnectionOptions,
) {
	return {
		...adminEndpoints,
		"/admin/shipping/settings": settingsEndpoint,
		"/admin/shipping/connection":
			createGetConnectionEndpoint(connectionOptions),
		"/admin/shipping/connection/origin":
			createUpdateConnectionOriginEndpoint(connectionOptions),
	};
}

export const adminEndpoints = {
	// Zones
	"/admin/shipping/zones": listZones,
	"/admin/shipping/zones/create": createZone,
	"/admin/shipping/zones/:id/update": updateZone,
	"/admin/shipping/zones/:id/delete": deleteZone,
	"/admin/shipping/zones/:id/rates": listRates,
	"/admin/shipping/zones/:id/rates/add": addRate,
	"/admin/shipping/rates/:id/update": updateRate,
	"/admin/shipping/rates/:id/delete": deleteRate,
	// Methods
	"/admin/shipping/methods": listMethods,
	"/admin/shipping/methods/create": createMethod,
	"/admin/shipping/methods/:id/update": updateMethod,
	"/admin/shipping/methods/:id/delete": deleteMethod,
	// Carriers
	"/admin/shipping/carriers": listCarriers,
	"/admin/shipping/carriers/create": createCarrier,
	"/admin/shipping/carriers/:id/update": updateCarrier,
	"/admin/shipping/carriers/:id/delete": deleteCarrier,
	// Shipments
	"/admin/shipping/shipments": listShipments,
	"/admin/shipping/shipments/create": createShipment,
	"/admin/shipping/shipments/:id": getShipment,
	"/admin/shipping/shipments/:id/update": updateShipment,
	"/admin/shipping/shipments/:id/status": updateShipmentStatus,
	"/admin/shipping/shipments/:id/delete": deleteShipment,
};
