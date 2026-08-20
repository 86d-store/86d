import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const voteFaq = createStoreEndpoint(
	"/faq/items/:id/vote",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			helpful: z.boolean(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		const item = await faqController.vote(ctx.params.id, ctx.body.helpful);

		return {
			helpfulCount: item.helpfulCount,
			notHelpfulCount: item.notHelpfulCount,
		};
	},
);
