import { createStoreEndpoint } from "@86d-app/core/api";
import type { FormsController } from "../../service";

export const listForms = createStoreEndpoint(
	"/forms",
	{
		method: "GET",
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const forms = await formsController.listForms({ activeOnly: true });

		return { forms };
	},
);
