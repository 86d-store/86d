import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { navigationSchema, navigationTables } from "./schema";
import { createNavigationController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Menu,
	MenuItem,
	MenuItemTree,
	MenuItemType,
	MenuLocation,
	MenuWithItems,
	NavigationController,
} from "./service";

export interface NavigationOptions extends ModuleConfig {
	/**
	 * Maximum nesting depth for menu items
	 * @default 3
	 */
	maxDepth?: number;
}

export default function navigation(options?: NavigationOptions): Module {
	return {
		id: "navigation",
		version: "0.0.1",
		schema: navigationSchema,
		tables: navigationTables,
		exports: {
			read: ["menuName", "menuSlug", "menuItemLabel"],
		},
		events: {
			emits: ["menu.created", "menu.updated", "menu.deleted"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createNavigationController(ctx.data, ctx.events);
			return { controllers: { navigation: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/navigation",
					component: "NavigationAdmin",
					label: "Navigation",
					icon: "List",
					group: "Content",
				},
			],
		},
		options,
	};
}
