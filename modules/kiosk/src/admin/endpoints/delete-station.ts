import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController } from "../../service";

export const deleteStationEndpoint = createAdminEndpoint(
	"/admin/kiosk/stations/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const deleted = await controller.deleteStation(ctx.params.id);
		return { deleted };
	},
);
