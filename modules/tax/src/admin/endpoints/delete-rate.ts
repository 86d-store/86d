import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TaxController } from "../../service";

export const adminDeleteRate = createAdminEndpoint(
	"/admin/tax/rates/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const deleted = await controller.deleteRate(ctx.params.id);
		if (!deleted) {
			return { error: "Tax rate not found", status: 404 };
		}
		return { success: true };
	},
);
