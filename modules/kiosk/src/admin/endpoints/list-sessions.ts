import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { KioskController, SessionStatus } from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";
import { projectAdminSession } from "./projections";

export const listSessionsEndpoint = createAdminEndpoint(
	"/admin/kiosk/sessions",
	{
		method: "GET",
		query: z.object({
			stationId: z.string().min(1).max(200).optional(),
			status: z
				.enum(["active", "completed", "abandoned", "timed-out"])
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
			const all = await controller.listSessions({
				stationId: ctx.query.stationId,
				status: ctx.query.status as SessionStatus | undefined,
			});
			const total = all.length;
			const sessions = all.slice(skip, skip + limit).map(projectAdminSession);
			return { sessions, total };
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Kiosk sessions are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
