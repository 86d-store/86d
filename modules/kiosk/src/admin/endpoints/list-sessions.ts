import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import {
	KIOSK_SESSION_ADMIN_SORT_FIELDS,
	type KioskController,
	type SessionStatus,
} from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";
import { projectAdminSession } from "./projections";

export const listSessionsEndpoint = createAdminEndpoint(
	"/admin/kiosk/sessions",
	{
		method: "GET",
		query: z.object({
			stationId: z.string().min(1).max(200).transform(sanitizeText).optional(),
			status: z
				.enum(["active", "completed", "abandoned", "timed-out"])
				.optional(),
			search: z.string().max(200).transform(sanitizeText).optional(),
			sort: z.enum(KIOSK_SESSION_ADMIN_SORT_FIELDS).optional(),
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
			const result = await controller.listSessionAdminPage({
				stationId: ctx.query.stationId,
				status: ctx.query.status as SessionStatus | undefined,
				search: ctx.query.search,
				sort: ctx.query.sort,
				direction: ctx.query.direction,
				take: limit,
				skip,
			});
			return {
				sessions: result.sessions.map(projectAdminSession),
				total: result.total,
			};
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Kiosk sessions are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
