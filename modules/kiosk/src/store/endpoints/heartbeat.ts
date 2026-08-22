import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController } from "../../service";

export const heartbeatEndpoint = createStoreEndpoint(
	"/kiosk/stations/:id/heartbeat",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const station = await controller.heartbeat(ctx.params.id);
		return { station };
	},
);
