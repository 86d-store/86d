import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "../../service";

export const adminDeletePriceOverride = createAdminEndpoint(
	"/admin/currencies/price-overrides/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		await controller.deletePriceOverride(ctx.params.id);
		return { success: true };
	},
);
