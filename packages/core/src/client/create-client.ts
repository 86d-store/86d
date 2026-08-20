import type { QueryClient } from "@tanstack/react-query";
import type { Endpoint } from "better-call";
import type { Module } from "../types/module";
import { createMutationHook, createQueryHook } from "./hooks";
import { getQueryClient } from "./query-client";
import type {
	ClientConfig,
	ModuleClient,
	MutationHook,
	QueryHook,
} from "./types";

/**
 * HTTP methods that use queries
 */
const QUERY_METHODS = new Set(["GET", "HEAD"]);

/**
 * Determine if an endpoint should be a query or mutation
 */
function isQueryEndpoint(endpoint: Endpoint): boolean {
	const method = endpoint.options?.method;
	if (Array.isArray(method)) {
		return method.every((m) => QUERY_METHODS.has(m));
	}
	return typeof method === "string" && QUERY_METHODS.has(method);
}

/**
 * Create hooks for all endpoints in a record
 */
function createEndpointHooks(
	endpoints: Record<string, Endpoint>,
	moduleId: string,
	namespace: "store" | "admin",
	config: ClientConfig,
	queryClient: QueryClient,
	// biome-ignore lint/suspicious/noExplicitAny: hook factory creates hooks for generic endpoint types
): Record<string, QueryHook<any, any> | MutationHook<any, any>> {
	// biome-ignore lint/suspicious/noExplicitAny: hook factory creates hooks for generic endpoint types
	const hooks: Record<string, QueryHook<any, any> | MutationHook<any, any>> =
		{};

	for (const [name, endpoint] of Object.entries(endpoints)) {
		const path = endpoint.path;
		const method = Array.isArray(endpoint.options?.method)
			? endpoint.options.method[0]
			: endpoint.options?.method || "GET";

		if (isQueryEndpoint(endpoint)) {
			hooks[name] = createQueryHook({
				path,
				method,
				moduleId,
				namespace,
				config,
				queryClient,
			});
		} else {
			hooks[name] = createMutationHook({
				path,
				method,
				moduleId,
				namespace,
				config,
				queryClient,
			});
		}
	}

	return hooks;
}

/**
 * Create a module client for making API requests
 *
 * @example
 * ```typescript
 * import cart from "@86d-app/cart";
 *
 * const client = createModuleClient([cart()], {
 *     baseURL: "/api",
 * });
 *
 * // In React component
 * const { data } = client.module("cart").store.getCart.useQuery();
 * ```
 */
export function createModuleClient<TModules extends Module[]>(
	modules: TModules,
	config: ClientConfig,
): ModuleClient<TModules> {
	const queryClient = config.queryClient ?? getQueryClient();

	// Build module map for quick lookup
	const moduleMap = new Map<string, Module>();
	for (const module of modules) {
		moduleMap.set(module.id, module);
	}

	// Cache for created hooks
	// biome-ignore lint/suspicious/noExplicitAny: hooks cache stores dynamically typed hooks
	type HooksEntry = { store: Record<string, any>; admin: Record<string, any> };
	const hooksCache = new Map<string, HooksEntry>();

	return {
		module: (moduleId: string) => {
			// Check cache first
			let cached = hooksCache.get(moduleId);
			if (cached) {
				// biome-ignore lint/suspicious/noExplicitAny: module accessor has dynamic type
				return cached as any;
			}

			const module = moduleMap.get(moduleId);
			if (!module) {
				throw new Error(
					`Module "${moduleId}" not found. Available modules: ${Array.from(moduleMap.keys()).join(", ")}`,
				);
			}

			const storeHooks = module.endpoints?.store
				? createEndpointHooks(
						module.endpoints.store,
						moduleId,
						"store",
						config,
						queryClient,
					)
				: {};

			const adminHooks = module.endpoints?.admin
				? createEndpointHooks(
						module.endpoints.admin,
						moduleId,
						"admin",
						config,
						queryClient,
					)
				: {};

			cached = { store: storeHooks, admin: adminHooks };
			hooksCache.set(moduleId, cached);

			// biome-ignore lint/suspicious/noExplicitAny: module accessor has dynamic type
			return cached as any;
		},
		queryClient,
		config,
	};
}
