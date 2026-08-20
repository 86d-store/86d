import { createStoreEndpoint } from "@86d-app/core/api";

export const listCategories = createStoreEndpoint(
	"/categories",
	{
		method: "GET",
	},
	async (ctx) => {
		// Call the controller directly to get category tree
		const categories = await ctx.context.controllers.category.getTree(ctx);
		return { categories };
	},
);
