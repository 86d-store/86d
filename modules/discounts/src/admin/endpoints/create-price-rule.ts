import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DiscountController } from "../../service";

const conditionSchema = z.object({
	type: z.enum([
		"minimum_subtotal",
		"minimum_item_count",
		"contains_product",
		"contains_category",
	]),
	value: z.union([z.string(), z.number()]),
});

export const adminCreatePriceRule = createAdminEndpoint(
	"/admin/discounts/price-rules/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
			value: z.number().nonnegative(),
			conditions: z.array(conditionSchema).optional(),
			appliesTo: z
				.enum(["all", "specific_products", "specific_categories"])
				.optional(),
			appliesToIds: z.array(z.string()).optional(),
			priority: z.number().int().nonnegative().optional(),
			stackable: z.boolean().optional(),
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
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const rule = await controller.createPriceRule(ctx.body);
		return { rule };
	},
);
