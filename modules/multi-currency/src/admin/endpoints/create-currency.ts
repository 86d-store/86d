import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "../../service";

export const adminCreateCurrency = createAdminEndpoint(
	"/admin/currencies/create",
	{
		method: "POST",
		body: z.object({
			code: z
				.string()
				.min(3)
				.max(3)
				.transform((s) => s.toUpperCase()),
			name: z.string().min(1).max(100).transform(sanitizeText),
			symbol: z.string().min(1).max(10),
			decimalPlaces: z.number().int().min(0).max(8).optional(),
			exchangeRate: z.number().positive().optional(),
			isBase: z.boolean().optional(),
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

		// Check for duplicate code
		const existing = await controller.getByCode(ctx.body.code);
		if (existing) {
			return { error: "Currency with this code already exists", status: 409 };
		}

		const currency = await controller.create(ctx.body);
		return { currency };
	},
);
