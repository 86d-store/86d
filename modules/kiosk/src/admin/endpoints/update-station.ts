import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { KioskController } from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";
import { projectAdminStation } from "./projections";

export const updateStationEndpoint = createAdminEndpoint(
	"/admin/kiosk/stations/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string().min(1).max(200) }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			location: z.string().max(500).transform(sanitizeText).optional(),
			isActive: z.boolean().optional(),
			settings: z
				.record(z.string().max(100), z.unknown())
				.refine((value) => Object.keys(value).length <= 100, {
					message: "Settings cannot contain more than 100 entries",
				})
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		try {
			const station = await controller.updateStation(ctx.params.id, {
				name: ctx.body.name,
				location: ctx.body.location,
				isActive: ctx.body.isActive,
				settings: ctx.body.settings,
			});
			if (!station) return { error: "Station not found", status: 404 };
			return { station: projectAdminStation(station) };
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Station update is unavailable", status: 503 };
			}
			throw error;
		}
	},
);
