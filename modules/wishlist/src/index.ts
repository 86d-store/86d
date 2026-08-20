import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { wishlistSchema } from "./schema";
import { createWishlistController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	WishlistController,
	WishlistItem,
	WishlistShare,
	WishlistSummary,
} from "./service";

export interface WishlistOptions extends ModuleConfig {
	/** Maximum items per customer wishlist */
	maxItems?: string;
}

export default function wishlist(options?: WishlistOptions): Module {
	return {
		id: "wishlist",
		version: "0.0.2",
		schema: wishlistSchema,
		exports: {
			read: ["wishlistItemCount", "isInWishlist"],
		},
		requires: {
			cart: { read: ["cartItems"], optional: true },
		},
		events: {
			emits: ["wishlist.itemAdded", "wishlist.itemRemoved", "wishlist.shared"],
		},
		init: async (ctx: ModuleContext) => {
			const maxItems = options?.maxItems
				? Number.parseInt(options.maxItems, 10)
				: undefined;
			const controller = createWishlistController(ctx.data, {
				maxItems:
					maxItems !== undefined && !Number.isNaN(maxItems)
						? maxItems
						: undefined,
			});
			return { controllers: { wishlist: controller } };
		},
		search: { store: "/wishlist/store-search" },
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/wishlist",
					component: "WishlistOverview",
					label: "Wishlist",
					icon: "Heart",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/account/wishlist",
					component: "WishlistPage",
				},
			],
		},
		options,
	};
}
