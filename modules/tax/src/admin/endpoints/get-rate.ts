import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TaxController } from "../../service";

export const adminGetRate = createAdminEndpoint(
	"/admin/tax/rates/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const taxRate = await controller.getRate(ctx.params.id);
		if (!taxRate) {
			return { error: "Tax rate not found", status: 404 };
		}
		return { taxRate };
	},
);
