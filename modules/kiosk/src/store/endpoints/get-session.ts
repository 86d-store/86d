import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController } from "../../service";

export const getSessionEndpoint = createStoreEndpoint(
	"/kiosk/sessions/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const session = await controller.getSession(ctx.params.id);
		return { session };
	},
);
