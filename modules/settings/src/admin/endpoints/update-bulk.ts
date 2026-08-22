import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { SettingsController } from "../../service";

export const updateBulkEndpoint = createAdminEndpoint(
	"/admin/settings/update-bulk",
	{
		method: "POST",
		body: z.object({
			settings: z
				.array(
					z.object({
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
				)
				.min(1)
				.max(50),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const settings = await controller.setBulk(ctx.body.settings);
		return { settings, updated: settings.length };
	},
);
