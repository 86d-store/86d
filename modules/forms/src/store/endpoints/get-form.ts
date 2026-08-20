import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FormsController } from "../../service";

export const getForm = createStoreEndpoint(
	"/forms/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const form = await formsController.getFormBySlug(ctx.params.slug);

		if (!form?.isActive) {
			return { form: null };
		}

		return { form };
	},
);
