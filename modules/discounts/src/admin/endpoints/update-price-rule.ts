import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
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

export const adminUpdatePriceRule = createAdminEndpoint(
	"/admin/discounts/price-rules/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z
				.string()
				.max(2000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			type: z.enum(["percentage", "fixed_amount", "free_shipping"]).optional(),
			value: z.number().nonnegative().optional(),
			conditions: z.array(conditionSchema).optional(),
			appliesTo: z
				.enum(["all", "specific_products", "specific_categories"])
				.optional(),
			appliesToIds: z.array(z.string()).optional(),
			priority: z.number().int().nonnegative().optional(),
			stackable: z.boolean().optional(),
			maximumUses: z.number().int().positive().nullable().optional(),
			isActive: z.boolean().optional(),
			startsAt: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.nullable()
				.optional(),
			endsAt: z
				.string()
				.datetime()
				.transform((s) => new Date(s))
				.nullable()
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const { description, ...rest } = ctx.body;
		const rule = await controller.updatePriceRule(ctx.params.id, {
			...rest,
			...(description !== undefined
				? { description: description ?? undefined }
				: {}),
		});
		if (!rule) {
			return { error: "Price rule not found", status: 404 };
		}
		return { rule };
	},
);
