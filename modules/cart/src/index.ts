import { acceptCapability } from "@86d-app/core/capabilities";
import { productResolveCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { cartSnapshotProvider } from "./capabilities";
import { cartStorage } from "./schema";
import { createCartControllers } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

// Export service types for other modules to use
export type { Cart, CartController, CartItem } from "./service";

export interface CartOptions extends ModuleConfig {
	/**
	 * Guest cart expiration time in milliseconds
	 * @default 604800000 (7 days)
	 */
	guestCartExpiration?: number;
	/**
	 * Maximum items per cart
	 * @default 100
	 */
	maxItemsPerCart?: number;
}

/**
 * Cart module factory function
 * Creates a cart module with customer and admin endpoints
 */
export default function cart(options?: CartOptions): Module {
	return {
		id: "cart",
		version: "1.0.0",
		storage: cartStorage,
		capabilities: {
			provides: [cartSnapshotProvider],
			accepts: [acceptCapability(productResolveCapability)],
		},
		exports: {
			read: ["cartItems", "cartTotal", "cartStatus"],
		},
		events: {
			emits: ["cart.updated", "cart.cleared", "cart.recovery.sent"],
		},

		/**
		 * Initialize and register controllers
		 */
		init: async (ctx: ModuleContext) => {
			const cartController = createCartControllers(ctx.data);

			return {
				controllers: { cart: cartController },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/carts",
					component: "CartList",
					label: "Carts",
					icon: "ShoppingCart",
					group: "Sales",
				},
				{
					path: "/admin/carts/abandoned",
					component: "AbandonedCarts",
					label: "Abandoned Carts",
					icon: "ShoppingCartSimple",
					group: "Sales",
				},
				{
					path: "/admin/carts/:id",
					component: "CartDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/cart",
					component: "CartPage",
				},
			],
		},

		options,
	};
}
