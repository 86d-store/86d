import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminUpdateCurrency = createAdminEndpoint(
	"/admin/currencies/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(100).transform(sanitizeText).optional(),
			symbol: z.string().min(1).max(10).optional(),
			decimalPlaces: z.number().int().min(0).max(8).optional(),
			exchangeRate: z.number().positive().optional(),
			isActive: z.boolean().optional(),
			symbolPosition: z.enum(["before", "after"]).optional(),
			thousandsSeparator: z.string().max(5).optional(),
			decimalSeparator: z.string().max(5).optional(),
			roundingMode: z.enum(["round", "ceil", "floor"]).optional(),
			sortOrder: z.number().int().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const currency = await controller.update(ctx.params.id, ctx.body);
		if (!currency) {
			return { error: "Currency not found", status: 404 };
		}
		return { currency };
	},
);
