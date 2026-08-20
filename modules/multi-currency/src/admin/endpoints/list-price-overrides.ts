import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "../../service";

export const adminListPriceOverrides = createAdminEndpoint(
	"/admin/currencies/price-overrides/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const overrides = await controller.listPriceOverrides(ctx.params.productId);
		return { overrides };
	},
);
