import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminGetCurrency = createAdminEndpoint(
	"/admin/currencies/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const currency = await controller.getById(ctx.params.id);
		if (!currency) {
			return { error: "Currency not found", status: 404 };
		}
		return { currency };
	},
);
