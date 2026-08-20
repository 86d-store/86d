import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { redirectsStorage } from "./schema";
import { createRedirectController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Redirect,
	RedirectController,
	RedirectStats,
} from "./service";

export interface RedirectsOptions extends ModuleConfig {
	/** Maximum number of redirects to evaluate per request. Default: 1000. */
	maxRedirects?: string;
}

export default function redirects(options?: RedirectsOptions): Module {
	return {
		id: "redirects",
		version: "0.0.1",
		storage: redirectsStorage,
		exports: {
			read: ["resolveRedirect", "activeRedirects"],
		},
		events: {
			emits: [
				"redirect.created",
				"redirect.updated",
				"redirect.deleted",
				"redirect.hit",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createRedirectController(ctx.data);
			return { controllers: { redirects: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/redirects",
					component: "RedirectsAdmin",
					label: "Redirects",
					icon: "CornerUpRight",
					group: "Content",
				},
			],
		},
		options,
	};
}
