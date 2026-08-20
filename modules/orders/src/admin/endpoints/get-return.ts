import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderController } from "../../service";

export const adminGetReturn = createAdminEndpoint(
	"/admin/orders/returns/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;

		const returnRequest = await controller.getReturn(ctx.params.id);
		if (!returnRequest) {
			return { error: "Return request not found", status: 404 };
		}

		// Also fetch the associated order for context
		const order = await controller.getById(returnRequest.orderId);

		return { returnRequest, order };
	},
);
