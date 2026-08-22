import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReportStatus, ReviewController } from "../../service";

export const listReports = createAdminEndpoint(
	"/admin/reviews/reports",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["pending", "resolved", "dismissed"]).optional(),
			reviewId: z.string().max(200).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const reports = await controller.listReports({
			status: ctx.query.status as ReportStatus | undefined,
			reviewId: ctx.query.reviewId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { reports };
	},
);
