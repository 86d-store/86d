import { createAdminEndpoint } from "@86d-store/core/api";
import type { TaxController } from "../../service";

export const adminListCategories = createAdminEndpoint(
	"/admin/tax/categories",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.tax as TaxController;
		const categories = await controller.listCategories();
		return { categories };
	},
);
