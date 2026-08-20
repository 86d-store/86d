import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminCreateDiscount = createAdminEndpoint(
	"/admin/discounts/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
			value: z.number().nonnegative(),
			minimumAmount: z.number().int().nonnegative().optional(),
			maximumUses: z.number().int().positive().optional(),
			isActive: z.boolean().optional(),
			startsAt: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.optional(),
			endsAt: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.optional(),
			appliesTo: z
				.enum(["all", "specific_products", "specific_categories"])
				.optional(),
			appliesToIds: z.array(z.string().max(200)).max(1000).optional(),
			stackable: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const discount = await controller.create(ctx.body);
		return { discount };
	},
);
