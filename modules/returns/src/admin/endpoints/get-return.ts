import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReturnController } from "../../service";

export const getReturn = createAdminEndpoint(
	"/admin/returns/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const returnRequest = await controller.getById(ctx.params.id);
		if (!returnRequest) {
			return { error: "Return request not found", status: 404 };
		}
		return { return: returnRequest };
	},
);
