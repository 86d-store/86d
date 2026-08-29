import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import {
	KIOSK_STATION_ADMIN_SORT_FIELDS,
	type KioskController,
} from "../../service";
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
			search: z.string().max(200).transform(sanitizeText).optional(),
			sort: z.enum(KIOSK_STATION_ADMIN_SORT_FIELDS).optional(),
			direction: z.enum(["asc", "desc"]).optional(),
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
			const result = await controller.listStationAdminPage({
				isActive: ctx.query.isActive,
				search: ctx.query.search,
				sort: ctx.query.sort,
				direction: ctx.query.direction,
				take: limit,
				skip,
			});
			return {
				stations: result.stations.map(projectAdminStation),
				total: result.total,
			};
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Kiosk stations are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
