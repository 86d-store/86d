import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminUpdateCode = createAdminEndpoint(
	"/admin/discounts/codes/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			isActive: z.boolean().optional(),
			maximumUses: z.number().int().positive().nullable().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;

		const updated = await controller.updateCode(ctx.params.id, {
			isActive: ctx.body.isActive,
			maximumUses: ctx.body.maximumUses,
		});

		if (!updated) {
			return { error: "Code not found", status: 404 };
		}

		return { code: updated };
	},
);
