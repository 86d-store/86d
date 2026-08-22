import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReturnController } from "../../service";

export const cancelReturn = createStoreEndpoint(
	"/returns/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.returns as ReturnController;
		const existing = await controller.getById(ctx.params.id);

		if (!existing) {
			return { error: "Return request not found", status: 404 };
		}

		if (existing.customerId !== userId) {
			return { error: "Return request not found", status: 404 };
		}

		const result = await controller.cancel(ctx.params.id);
		if (result) {
			void ctx.context.events?.emit("return.cancelled", {
				returnId: result.id,
				orderId: result.orderId,
				orderNumber: result.orderId,
				email: result.customerEmail ?? "",
				customerName: "",
			});
		}
		return { return: result };
	},
);
