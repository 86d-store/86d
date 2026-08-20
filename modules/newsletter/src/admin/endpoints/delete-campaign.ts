import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NewsletterController } from "../../service";

export const deleteCampaignEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const deleted = await controller.deleteCampaign(ctx.params.id);
		return { deleted };
	},
);
