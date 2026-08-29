import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController } from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";
import { projectAdminStation } from "./projections";

export const listStationsEndpoint = createAdminEndpoint(
	"/admin/kiosk/stations",
	{
		method: "GET",
		query: z.object({
			isActive: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		try {
			const all = await controller.listStations({
				isActive: ctx.query.isActive,
			});
			const total = all.length;
			const stations = all.slice(skip, skip + limit).map(projectAdminStation);
			return { stations, total };
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Kiosk stations are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
