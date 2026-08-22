import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { SettingGroup, SettingsController } from "../../service";

export const updateSettingEndpoint = createAdminEndpoint(
	"/admin/settings/update",
	{
		method: "POST",
		body: z.object({
			key: z.string().max(200).transform(sanitizeText),
			value: z.string().max(50000).transform(sanitizeText),
			group: z
				.enum([
					"general",
					"contact",
					"social",
					"legal",
					"commerce",
					"appearance",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const setting = await controller.set(
			ctx.body.key,
			ctx.body.value,
			ctx.body.group as SettingGroup | undefined,
		);
		return { setting };
	},
);
