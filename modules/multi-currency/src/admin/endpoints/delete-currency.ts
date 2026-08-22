import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminDeleteCurrency = createAdminEndpoint(
	"/admin/currencies/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const result = await controller.delete(ctx.params.id);
		if (!result.deleted) {
			return {
				error: result.error ?? "Failed to delete currency",
				status: 400,
			};
		}
		return { success: true };
	},
);
