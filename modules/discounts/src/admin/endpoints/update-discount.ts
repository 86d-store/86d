import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DiscountController } from "../../service";

export const adminUpdateDiscount = createAdminEndpoint(
	"/admin/discounts/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			type: z.enum(["percentage", "fixed_amount", "free_shipping"]).optional(),
			value: z.number().nonnegative().optional(),
			minimumAmount: z.number().int().nonnegative().nullable().optional(),
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
			appliesTo: z
				.enum(["all", "specific_products", "specific_categories"])
				.optional(),
			appliesToIds: z.array(z.string().max(200)).max(1000).optional(),
			stackable: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const discount = await controller.update(ctx.params.id, ctx.body);
		if (!discount) {
			return { error: "Discount not found", status: 404 };
		}
		return { discount };
	},
);
