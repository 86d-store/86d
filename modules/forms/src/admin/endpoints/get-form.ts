import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FormsController } from "../../service";

export const getForm = createAdminEndpoint(
	"/admin/forms/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const form = await formsController.getForm(ctx.params.id);

		if (!form) {
			return { error: "Form not found", status: 404 };
		}

		return { form };
	},
);
