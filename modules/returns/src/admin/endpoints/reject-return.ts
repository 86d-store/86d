import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReturnController } from "../../service";

export const rejectReturn = createAdminEndpoint(
	"/admin/returns/:id/reject",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			adminNotes: z.string().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.returns as ReturnController;
		const result = await controller.reject(ctx.params.id, ctx.body.adminNotes);
		if (!result) {
			return { error: "Return request not found", status: 404 };
		}
		void ctx.context.events?.emit("return.rejected", {
			returnId: result.id,
			orderId: result.orderId,
			orderNumber: result.orderId,
			email: result.customerEmail ?? "",
			customerName: "",
			reason: result.reason,
			adminNotes: result.adminNotes,
		});
		return { return: result };
	},
);
