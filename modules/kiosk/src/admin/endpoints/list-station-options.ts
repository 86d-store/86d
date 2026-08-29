import { createAdminEndpoint } from "@86d-app/core/api";
import type { KioskController } from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";
import { projectAdminStationOption } from "./projections";

export const listStationOptionsEndpoint = createAdminEndpoint(
	"/admin/kiosk/station-options",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		try {
			const stations = await controller.listStations();
			return {
				stations: stations.map(projectAdminStationOption),
			};
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Station registrations are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
