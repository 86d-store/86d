import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminLinkTransaction = createAdminEndpoint(
	"/admin/tax/transactions/:id/link",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			orderId: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const transaction = await controller.linkTransactionToOrder(
			ctx.params.id,
			ctx.body.orderId,
		);
		if (!transaction) {
			return { error: "Transaction not found", status: 404 };
		}
		return { transaction };
	},
);
