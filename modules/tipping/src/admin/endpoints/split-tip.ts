import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TippingController } from "../../service";

export const splitTip = createAdminEndpoint(
	"/admin/tipping/tips/:id/split",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			splits: z
				.array(
					z.object({
						recipientType: z.enum(["driver", "server", "staff", "store"]),
						recipientId: z.string().max(200).optional(),
						amount: z.number().positive().max(100000),
					}),
				)
				.min(2)
				.max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const tips = await controller.splitTip(ctx.params.id, ctx.body.splits);

		if (tips.length === 0) {
			return { error: "Tip not found", status: 404 };
		}

		return { tips };
	},
);
