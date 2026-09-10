import { createAdminEndpoint } from "@86d-store/core/api";
import type { MultiCurrencyController } from "../../service";

export const adminListCurrencies = createAdminEndpoint(
	"/admin/currencies",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const currencies = await controller.list();
		return { currencies };
	},
);
