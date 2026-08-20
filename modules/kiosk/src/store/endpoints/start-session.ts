import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { KioskController } from "../../service";

export const startSessionEndpoint = createStoreEndpoint(
	"/kiosk/sessions",
	{
		method: "POST",
		body: z.object({
			stationId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const session = await controller.startSession(ctx.body.stationId);
		return { session };
	},
);
