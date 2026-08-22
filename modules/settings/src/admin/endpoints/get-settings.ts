import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SettingGroup, SettingsController } from "../../service";

export const getSettingsEndpoint = createAdminEndpoint(
	"/admin/settings",
	{
		method: "GET",
		query: z.object({
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
		if (ctx.query.group) {
			const settings = await controller.getByGroup(
				ctx.query.group as SettingGroup,
			);
			return { settings };
		}
		const settings = await controller.getAll();
		return { settings };
	},
);
