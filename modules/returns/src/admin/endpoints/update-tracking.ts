import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReturnController } from "../../service";

export const updateTracking = createAdminEndpoint(
	"/admin/returns/:id/tracking",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			trackingNumber: z.string().min(1).max(200),
			carrier: z.string().max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const result = await controller.updateTracking(
			ctx.params.id,
			ctx.body.trackingNumber,
			ctx.body.carrier,
		);
		if (!result) {
			return { error: "Return request not found", status: 404 };
		}
		return { return: result };
	},
);
