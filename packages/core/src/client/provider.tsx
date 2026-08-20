"use client";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { Module } from "../types/module";
import { createModuleClient } from "./create-client";
import { getQueryClient } from "./query-client";
import type { ClientConfig, ModuleClient } from "./types";

/**
 * Context for the module client
 */
const ModuleClientContext = createContext<ModuleClient | null>(null);

export interface ModuleClientProviderProps {
	children: ReactNode;
	/**
	 * Base URL for API requests (e.g., "/api" or "https://api.example.com")
	 */
	baseURL: string;
	/**
	 * Modules to enable for this client
	 */
	modules: Module[];
	/**
	 * Optional headers to include with every request
	 */
	headers?: ClientConfig["headers"];
	/**
	 * Credentials mode for fetch
	 */
	credentials?: ClientConfig["credentials"];
	/**
	 * Optional query client instance (for SSR hydration)
	 */
	queryClient?: QueryClient;
	/**
	 * Error handler
	 */
	onError?: (error: Error) => void;
}

/**
 * Provider component for the module client
 *
 * @example
 * ```tsx
 * import { ModuleClientProvider } from "@86d-app/core/client/provider";
 * import cart from "@86d-app/cart";
 *
 * function App({ children }) {
 *     return (
 *         <ModuleClientProvider
 *             baseURL="/api"
 *             modules={[cart()]}
 *         >
 *             {children}
 *         </ModuleClientProvider>
 *     );
 * }
 * ```
 */
export function ModuleClientProvider({
	children,
	baseURL,
	modules,
	headers,
	credentials,
	queryClient: providedQueryClient,
	onError,
}: ModuleClientProviderProps) {
	const queryClient = useMemo(
		() => providedQueryClient ?? getQueryClient(),
		[providedQueryClient],
	);

	const client = useMemo(() => {
		const config: ClientConfig = { baseURL, queryClient };
		if (headers !== undefined) config.headers = headers;
		if (credentials !== undefined) config.credentials = credentials;
		if (onError !== undefined) config.onError = onError;
		return createModuleClient(modules, config);
	}, [modules, baseURL, headers, credentials, queryClient, onError]);

	return (
		<QueryClientProvider client={queryClient}>
			<ModuleClientContext.Provider value={client}>
				{children}
			</ModuleClientContext.Provider>
		</QueryClientProvider>
	);
}

/**
 * Hook to access the module client
 *
 * @example
 * ```tsx
 * function CartButton() {
 *     const client = useModuleClient();
 *
 *     const { data: cart } = client.module("cart").store.getCart.useQuery();
 *     const addToCart = client.module("cart").store.addToCart.useMutation();
 *
 *     return (
 *         <button onClick={() => addToCart.mutate({ productId: "123", quantity: 1, price: 29.99 })}>
 *             Add to Cart ({cart?.itemCount ?? 0})
 *         </button>
 *     );
 * }
 * ```
 */
export function useModuleClient<
	TModules extends Module[] = Module[],
>(): ModuleClient<TModules> {
	const client = useContext(ModuleClientContext);
	if (!client) {
		throw new Error(
			"useModuleClient must be used within a ModuleClientProvider. " +
				'Wrap your app with <ModuleClientProvider modules={[...]} baseURL="/api">...',
		);
	}
	return client as ModuleClient<TModules>;
}
