import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TippingController } from "../../service";

export const updateSettings = createAdminEndpoint(
	"/admin/tipping/settings/update",
	{
		method: "PUT",
		body: z.object({
			presetPercents: z
				.array(z.number().min(0).max(100))
				.min(1)
				.max(10)
				.optional(),
			allowCustom: z.boolean().optional(),
			maxPercent: z.number().min(1).max(1000).optional(),
			maxAmount: z.number().min(1).max(1000000).optional(),
			enableSplitting: z.boolean().optional(),
			defaultRecipientType: z.string().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const settings = await controller.updateSettings({
			...(ctx.body.presetPercents !== undefined
				? { presetPercents: ctx.body.presetPercents }
				: {}),
			...(ctx.body.allowCustom !== undefined
				? { allowCustom: ctx.body.allowCustom }
				: {}),
			...(ctx.body.maxPercent !== undefined
				? { maxPercent: ctx.body.maxPercent }
				: {}),
			...(ctx.body.maxAmount !== undefined
				? { maxAmount: ctx.body.maxAmount }
				: {}),
			...(ctx.body.enableSplitting !== undefined
				? { enableSplitting: ctx.body.enableSplitting }
				: {}),
			...(ctx.body.defaultRecipientType !== undefined
				? { defaultRecipientType: ctx.body.defaultRecipientType }
				: {}),
		});
		return { settings };
	},
);
