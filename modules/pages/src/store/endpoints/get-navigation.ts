import { createStoreEndpoint } from "@86d-app/core/api";
import type { PagesController } from "../../service";

export const getNavigationEndpoint = createStoreEndpoint(
	"/pages/navigation",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.pages as PagesController;
		const pages = await controller.getNavigationPages();
		return {
			pages: pages.map((p) => ({
				id: p.id,
				title: p.title,
				slug: p.slug,
				parentId: p.parentId,
				position: p.position,
			})),
		};
	},
);
