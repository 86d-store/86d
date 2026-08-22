import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { KioskController } from "../../service";

export const createStationEndpoint = createAdminEndpoint(
	"/admin/kiosk/stations/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			location: z.string().max(500).transform(sanitizeText).optional(),
			settings: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const station = await controller.registerStation({
			name: ctx.body.name,
			location: ctx.body.location,
			settings: ctx.body.settings,
		});
		return { station };
	},
);
