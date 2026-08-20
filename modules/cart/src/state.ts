import { makeAutoObservable } from "@86d-app/core/state";

export interface OptimisticCartItem {
	id: string;
	productId: string;
	variantId?: string | null;
	quantity: number;
	price: number;
	product: {
		name: string;
		price: number;
		images?: string[] | null;
		slug: string;
	};
	variant?: {
		name: string;
		options?: Record<string, string>;
	} | null;
}

export interface OptimisticCartData {
	id: string;
	items: OptimisticCartItem[];
	subtotal: number;
	itemCount: number;
}

/**
 * Cart UI state — shared across components via MobX.
 * Replaces window.CustomEvent("cart-toggle" | "cart-open" | "cart-updated").
 */
export const cartState = makeAutoObservable({
	isDrawerOpen: false,
	itemCount: 0,
	optimisticCart: null as OptimisticCartData | null,

	toggleDrawer() {
		this.isDrawerOpen = !this.isDrawerOpen;
	},

	openDrawer() {
		this.isDrawerOpen = true;
	},

	closeDrawer() {
		this.isDrawerOpen = false;
	},

	setItemCount(n: number) {
		this.itemCount = n;
	},

	setOptimisticCart(cart: OptimisticCartData | null) {
		this.optimisticCart = cart;
	},
});

export type CartState = typeof cartState;
