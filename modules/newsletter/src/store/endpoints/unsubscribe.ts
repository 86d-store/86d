import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NewsletterController } from "../../service";

export const unsubscribeEndpoint = createStoreEndpoint(
	"/newsletter/unsubscribe",
	{
		method: "POST",
		body: z.object({
			email: z.string().email().max(320),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const subscriber = await controller.unsubscribe(ctx.body.email);
		return { subscriber };
	},
);
