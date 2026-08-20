import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReturnController } from "../../service";

export const getReturnStatus = createStoreEndpoint(
	"/returns/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.returns as ReturnController;
		const returnRequest = await controller.getById(ctx.params.id);

		if (!returnRequest) {
			return { error: "Return request not found", status: 404 };
		}

		if (returnRequest.customerId !== userId) {
			return { error: "Return request not found", status: 404 };
		}

		return { return: returnRequest };
	},
);
