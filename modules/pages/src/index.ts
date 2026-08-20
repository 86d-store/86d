import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { toMarkdownPageDetail, toMarkdownPageListing } from "./markdown";
import { pagesStorage } from "./schema";
import { createPagesController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { Page, PageStatus, PagesController } from "./service";

export interface PagesOptions extends ModuleConfig {
	/** Default number of pages per listing page (default: "50") */
	pagesPerPage?: string;
}

export default function pages(options?: PagesOptions): Module {
	return {
		id: "pages",
		version: "0.0.1",
		storage: pagesStorage,
		exports: {
			read: ["pageTitle", "pageSlug"],
		},
		events: {
			emits: ["page.published", "page.unpublished", "page.deleted"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createPagesController(ctx.data);
			return { controllers: { pages: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/pages",
					component: "PagesAdmin",
					label: "Pages",
					icon: "Files",
					group: "Content",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/pages",
					component: "PageListing",
					toMarkdown: toMarkdownPageListing,
				},
				{
					path: "/p/:slug",
					component: "PageDetail",
					toMarkdown: toMarkdownPageDetail,
				},
			],
		},
		options,
	};
}
