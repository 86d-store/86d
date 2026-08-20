"use client";

import { createContext, useContext } from "react";

// biome-ignore lint/suspicious/noExplicitAny: store context is typed at consumption site via generic
const StoreContext = createContext<Record<string, any> | null>(null);

export interface StoreContextProviderProps {
	children: React.ReactNode;
	// biome-ignore lint/suspicious/noExplicitAny: store shape varies per app configuration
	store: Record<string, any>;
}

/**
 * Provides the MobX root store to all module components.
 * Set up once in the store app's provider tree.
 */
export function StoreContextProvider({
	children,
	store,
}: StoreContextProviderProps) {
	return (
		<StoreContext.Provider value={store}>{children}</StoreContext.Provider>
	);
}

/**
 * Access the MobX root store from any module component.
 * Use a type parameter to get typed access to specific state slices.
 *
 * @example
 * ```tsx
 * const { cart } = useStoreContext<{ cart: { openDrawer: () => void } }>();
 * cart.openDrawer();
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: default type allows untyped usage
export function useStoreContext<T = Record<string, any>>(): T {
	const ctx = useContext(StoreContext);
	if (!ctx) {
		throw new Error(
			"useStoreContext must be used within a StoreContextProvider",
		);
	}
	return ctx as T;
}
