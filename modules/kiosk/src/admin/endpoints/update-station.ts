import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { KioskController } from "../../service";

export const updateStationEndpoint = createAdminEndpoint(
	"/admin/kiosk/stations/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			location: z.string().max(500).transform(sanitizeText).optional(),
			isActive: z.boolean().optional(),
			settings: z.record(z.string().max(100), z.unknown()).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const station = await controller.updateStation(ctx.params.id, {
			name: ctx.body.name,
			location: ctx.body.location,
			isActive: ctx.body.isActive,
			settings: ctx.body.settings,
		});
		return { station };
	},
);
