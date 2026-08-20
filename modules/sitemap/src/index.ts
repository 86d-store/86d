import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { sitemapStorage } from "./schema";
import { MAX_ENTRIES_PER_SITEMAP } from "./service";
import { createSitemapController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ChangeFreq,
	SitemapConfig,
	SitemapController,
	SitemapEntry,
	SitemapStats,
} from "./service";
export { MAX_ENTRIES_PER_SITEMAP };

export interface SitemapOptions extends ModuleConfig {
	/** Base URL for the store. Default: https://example.com */
	baseUrl?: string;
}

export default function sitemap(options?: SitemapOptions): Module {
	return {
		id: "sitemap",
		version: "0.0.1",
		storage: sitemapStorage,
		exports: {
			read: ["sitemapXml", "sitemapEntries"],
		},
		events: {
			emits: [
				"sitemap.regenerated",
				"sitemap.entry.added",
				"sitemap.entry.removed",
				"sitemap.config.updated",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSitemapController(ctx.data);
			return { controllers: { sitemap: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/sitemap",
					component: "SitemapAdmin",
					label: "Sitemap",
					icon: "Map",
					group: "Content",
				},
			],
		},
		options,
	};
}
