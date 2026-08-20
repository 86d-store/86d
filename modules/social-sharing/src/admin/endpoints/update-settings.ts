import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SocialSharingController } from "../../service";

export const updateSettingsEndpoint = createAdminEndpoint(
	"/admin/social-sharing/settings/update",
	{
		method: "PUT",
		body: z.object({
			enabledNetworks: z
				.array(
					z.enum([
						"twitter",
						"facebook",
						"pinterest",
						"linkedin",
						"whatsapp",
						"email",
						"copy-link",
					]),
				)
				.optional(),
			defaultMessage: z.string().max(500).transform(sanitizeText).optional(),
			hashtags: z
				.array(z.string().max(100).transform(sanitizeText))
				.max(50)
				.optional(),
			customTemplates: z
				.record(z.string().max(50), z.string().max(1000))
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const settings = await controller.updateSettings({
			enabledNetworks: ctx.body.enabledNetworks,
			defaultMessage: ctx.body.defaultMessage,
			hashtags: ctx.body.hashtags,
			customTemplates: ctx.body.customTemplates,
		});
		return { settings };
	},
);
