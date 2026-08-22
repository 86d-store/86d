import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { abandonedCartRecoveryResolveProvider } from "./capabilities";
import { abandonedCartsStorage } from "./schema";
import { createAbandonedCartController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AbandonedCart,
	AbandonedCartController,
	AbandonedCartControllerOptions,
	AbandonedCartStats,
	AbandonedCartWithAttempts,
	CartItemSnapshot,
	RecoveryAttempt,
} from "./service";

export interface AbandonedCartOptions extends ModuleConfig {
	/** Minutes of inactivity before a cart is considered abandoned (default: 60) */
	abandonmentThresholdMinutes?: number;
	/** Maximum number of recovery attempts per cart (default: 3) */
	maxRecoveryAttempts?: number;
	/** Days after which abandoned carts are automatically expired (default: 30) */
	expirationDays?: number;
}

export default function abandonedCarts(options?: AbandonedCartOptions): Module {
	return {
		id: "abandoned-carts",
		version: "0.0.1",
		storage: abandonedCartsStorage,
		capabilities: { provides: [abandonedCartRecoveryResolveProvider] },
		requires: {
			cart: { read: ["cartItems", "cartTotal"] },
			customers: { read: ["customerEmail"] },
		},
		exports: {
			read: ["abandonedCartCount", "recoveryRate"],
		},
		events: {
			emits: [
				"cart.abandoned",
				"cart.recoveryAttempted",
				"cart.recovered",
				"cart.expired",
				"cart.dismissed",
			],
		},
		init: async (ctx: ModuleContext) => {
			const opts = ctx.options as Record<string, unknown>;
			const controllerOpts: Record<string, number> = {};
			if (typeof opts.maxRecoveryAttempts === "number") {
				controllerOpts.maxRecoveryAttempts = opts.maxRecoveryAttempts;
			}
			if (typeof opts.expirationDays === "number") {
				controllerOpts.expirationDays = opts.expirationDays;
			}
			if (typeof opts.abandonmentThresholdMinutes === "number") {
				controllerOpts.abandonmentThresholdMinutes =
					opts.abandonmentThresholdMinutes;
			}
			const controller = createAbandonedCartController(
				ctx.data,
				controllerOpts,
				ctx.events,
			);
			return { controllers: { abandonedCarts: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/abandoned-carts",
					component: "AbandonedCartOverview",
					label: "Abandoned Carts",
					icon: "ShoppingCart",
					group: "Sales",
				},
			],
		},
		options,
	};
}
