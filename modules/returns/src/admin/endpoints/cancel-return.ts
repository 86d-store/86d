import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReturnController } from "../../service";

export const cancelReturn = createAdminEndpoint(
	"/admin/returns/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const result = await controller.cancel(ctx.params.id);
		if (!result) {
			return { error: "Return request not found", status: 404 };
		}
		return { return: result };
	},
);
