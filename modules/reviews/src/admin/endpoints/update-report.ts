import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReportStatus, ReviewController } from "../../service";

export const updateReport = createAdminEndpoint(
	"/admin/reviews/reports/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum(["resolved", "dismissed"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const report = await controller.updateReportStatus(
			ctx.params.id,
			ctx.body.status as ReportStatus,
		);
		if (!report) return { error: "Report not found", status: 404 };
		return { report };
	},
);
