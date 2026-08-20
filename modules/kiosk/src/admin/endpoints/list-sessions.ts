import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { KioskController, SessionStatus } from "../../service";

export const listSessionsEndpoint = createAdminEndpoint(
	"/admin/kiosk/sessions",
	{
		method: "GET",
		query: z.object({
			stationId: z.string().optional(),
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
		const all = await controller.listSessions({
			stationId: ctx.query.stationId,
			status: ctx.query.status as SessionStatus | undefined,
		});
		const total = all.length;
		const sessions = all.slice(skip, skip + limit);
		return { sessions, total };
	},
);
