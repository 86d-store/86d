import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { toMarkdownSitemap } from "./markdown";
import { seoStorage } from "./schema";
import { createSeoController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	MetaTag,
	Redirect,
	RedirectStatusCode,
	SeoController,
} from "./service";

export interface SeoOptions extends ModuleConfig {
	/** Default robots meta value (default: "index, follow") */
	defaultRobots?: string;
}

export default function seo(options?: SeoOptions): Module {
	return {
		id: "seo",
		version: "0.0.1",
		storage: seoStorage,
		exports: {
			read: ["metaTitle", "metaDescription", "canonicalUrl"],
		},
		events: {
			emits: ["seo.meta.updated", "seo.redirect.created"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSeoController(ctx.data);
			return { controllers: { seo: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/seo",
					component: "SeoAdmin",
					label: "SEO",
					icon: "Search",
					group: "Content",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/sitemap",
					component: "Sitemap",
					toMarkdown: toMarkdownSitemap,
				},
			],
		},
		options,
	};
}
