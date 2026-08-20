import { cartState } from "@86d-app/cart/state";
import { checkoutState } from "@86d-app/checkout/state";
import { productsState } from "@86d-app/products/state";
import { uiState } from "./ui-state";

/**
 * Root store composing all module state slices.
 * Available to any module component via useStoreContext() from @86d-app/core/client,
 * or via useStore() from hooks/use-store.
 */
export const store = {
	cart: cartState,
	checkout: checkoutState,
	products: productsState,
	ui: uiState,
} as const;

export type RootStore = typeof store;
