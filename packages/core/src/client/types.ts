/**
 * Client type utilities for extracting types from better-call endpoints
 */

import type {
	QueryClient,
	UseMutationOptions,
	UseMutationResult,
	UseQueryOptions,
	UseQueryResult,
} from "@tanstack/react-query";
import type { Endpoint } from "better-call";
import type { z } from "zod";
import type { Module } from "../types/module";

// =============================================================================
// Endpoint Type Extraction
// =============================================================================

/**
 * Extract the HTTP method from an endpoint
 */
export type ExtractMethod<E> = E extends { options: { method: infer M } }
	? M extends string[]
		? M[number]
		: M
	: never;

/**
 * Extract the path from an endpoint
 */
export type ExtractPath<E> = E extends { path: infer P } ? P : never;

/**
 * Extract the body type from an endpoint (input)
 */
export type ExtractBodyInput<E> = E extends { options: { body: infer B } }
	? B extends z.ZodType
		? z.input<B>
		: B extends { _input: infer I }
			? I
			: // biome-ignore lint/suspicious/noExplicitAny: fallback for non-zod body types
				any
	: undefined;

/**
 * Extract the body type from an endpoint (output/validated)
 */
export type ExtractBody<E> = E extends { options: { body: infer B } }
	? B extends z.ZodType
		? z.output<B>
		: B extends { _output: infer O }
			? O
			: // biome-ignore lint/suspicious/noExplicitAny: fallback for non-zod body types
				any
	: undefined;

/**
 * Extract the query type from an endpoint
 */
export type ExtractQuery<E> = E extends { options: { query: infer Q } }
	? Q extends z.ZodType
		? z.output<Q>
		: Q extends { _output: infer O }
			? O
			: Record<string, unknown> | undefined
	: Record<string, unknown> | undefined;

/**
 * Extract the query input type from an endpoint
 */
export type ExtractQueryInput<E> = E extends { options: { query: infer Q } }
	? Q extends z.ZodType
		? z.input<Q>
		: Q extends { _input: infer I }
			? I
			: Record<string, unknown> | undefined
	: Record<string, unknown> | undefined;

/**
 * Extract response type from endpoint
 * The endpoint is a function that returns Promise<R>
 */
// biome-ignore lint/suspicious/noExplicitAny: needed for function signature matching in conditional types
export type ExtractResponse<E> = E extends (...args: any[]) => Promise<infer R>
	? R
	: // biome-ignore lint/suspicious/noExplicitAny: needed for function signature matching in conditional types
		E extends (...args: any[]) => Promise<infer R>
		? R
		: unknown;

// =============================================================================
// Query/Mutation Detection
// =============================================================================

/**
 * HTTP methods that should use useQuery
 */
export type QueryMethod = "GET" | "HEAD";

/**
 * HTTP methods that should use useMutation
 */
export type MutationMethod = "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * Check if a method is a query method
 */
export type IsQueryMethod<M> = M extends QueryMethod ? true : false;

/**
 * Check if a method is a mutation method
 */
export type IsMutationMethod<M> = M extends MutationMethod ? true : false;

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Input type for query hooks (query params + path params)
 */
export type QueryInput<E> =
	ExtractQueryInput<E> extends undefined
		? ExtractPath<E> extends `${string}:${string}`
			? { params: Record<string, string> }
			: undefined
		: ExtractQueryInput<E> &
				(ExtractPath<E> extends `${string}:${string}`
					? { params: Record<string, string> }
					: Record<string, never>);

/**
 * Input type for mutation hooks (body + path params)
 */
export type MutationInput<E> =
	ExtractBodyInput<E> extends undefined
		? ExtractPath<E> extends `${string}:${string}`
			? { params: Record<string, string> }
			: undefined
		: ExtractBodyInput<E> &
				(ExtractPath<E> extends `${string}:${string}`
					? { params: Record<string, string> }
					: Record<string, never>);

/**
 * Query hook interface - for GET endpoints
 */
export interface QueryHook<TInput, TOutput, TError = Error> {
	/**
	 * React hook to fetch data
	 */
	useQuery: (
		input?: TInput,
		options?: Omit<UseQueryOptions<TOutput, TError>, "queryKey" | "queryFn">,
	) => UseQueryResult<TOutput, TError>;

	/**
	 * Invalidate the query cache
	 */
	invalidate: (input?: TInput) => Promise<void>;

	/**
	 * Prefetch data into the cache
	 */
	prefetch: (input?: TInput) => Promise<void>;

	/**
	 * Get the query key for this endpoint
	 */
	getQueryKey: (input?: TInput) => readonly unknown[];

	/**
	 * Fetch data directly (outside React)
	 */
	fetch: (input?: TInput) => Promise<TOutput>;
}

/**
 * Mutation hook interface - for POST/PUT/DELETE endpoints
 */
export interface MutationHook<TInput, TOutput, TError = Error> {
	/**
	 * React hook to mutate data
	 */
	useMutation: (
		options?: Omit<UseMutationOptions<TOutput, TError, TInput>, "mutationFn">,
	) => UseMutationResult<TOutput, TError, TInput>;

	/**
	 * Execute mutation directly (outside React)
	 */
	mutate: (input: TInput) => Promise<TOutput>;

	/**
	 * Get the mutation key for this endpoint
	 */
	getMutationKey: () => readonly unknown[];
}

/**
 * Convert an endpoint to either a QueryHook or MutationHook based on method
 */
export type EndpointToHook<E> =
	IsQueryMethod<ExtractMethod<E>> extends true
		? QueryHook<QueryInput<E>, ExtractResponse<E>>
		: MutationHook<MutationInput<E>, ExtractResponse<E>>;

// =============================================================================
// Module Client Types
// =============================================================================

/**
 * Map of endpoint names to their hook types
 */
export type EndpointHooks<TEndpoints extends Record<string, Endpoint>> = {
	[K in keyof TEndpoints]: EndpointToHook<TEndpoints[K]>;
};

/**
 * Extract module by ID from a tuple of modules
 */
export type ExtractModuleById<
	TModules extends Module[],
	TId extends string,
> = TModules extends [infer First, ...infer Rest]
	? First extends Module
		? First["id"] extends TId
			? First
			: Rest extends Module[]
				? ExtractModuleById<Rest, TId>
				: never
		: never
	: never;

/**
 * Module client accessor type
 */
export type ModuleAccessor<TModule extends Module> = {
	store: TModule["endpoints"] extends { store: infer S }
		? S extends Record<string, Endpoint>
			? EndpointHooks<S>
			: Record<string, never>
		: Record<string, never>;
	admin: TModule["endpoints"] extends { admin: infer A }
		? A extends Record<string, Endpoint>
			? EndpointHooks<A>
			: Record<string, never>
		: Record<string, never>;
};

/**
 * Loose endpoint hook type — combines QueryHook + MutationHook methods
 * so that untyped module access (generic Module[]) still provides usable hooks.
 */
export interface AnyEndpointHook
	// biome-ignore lint/suspicious/noExplicitAny: loose type for untyped module access
	extends QueryHook<any, any>,
		// biome-ignore lint/suspicious/noExplicitAny: loose type for untyped module access
		MutationHook<any, any> {}

/**
 * Fallback accessor when ExtractModuleById resolves to never
 * (i.e. when using generic Module[] instead of a specific tuple).
 */
export interface AnyModuleAccessor {
	store: Record<string, AnyEndpointHook>;
	admin: Record<string, AnyEndpointHook>;
}

/**
 * Client configuration
 */
export interface ClientConfig {
	/**
	 * Base URL for API requests
	 */
	baseURL: string;

	/**
	 * Optional headers to include with every request
	 */
	headers?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>)
		| undefined;

	/**
	 * Credentials mode for fetch
	 */
	credentials?: globalThis.RequestCredentials | undefined;

	/**
	 * Optional query client instance
	 */
	queryClient?: QueryClient | undefined;

	/**
	 * Error handler
	 */
	onError?: ((error: Error) => void) | undefined;
}

/**
 * The main module client type
 */
export interface ModuleClient<TModules extends Module[] = Module[]> {
	/**
	 * Access module endpoints by module ID.
	 * Returns typed accessor when modules are a known tuple, otherwise
	 * falls back to AnyModuleAccessor for generic Module[] usage.
	 */
	module: <K extends TModules[number]["id"]>(
		moduleId: K,
	) => [ExtractModuleById<TModules, K extends string ? K : never>] extends [
		never,
	]
		? AnyModuleAccessor
		: ModuleAccessor<ExtractModuleById<TModules, K extends string ? K : never>>;

	/**
	 * Get the query client instance
	 */
	queryClient: QueryClient;

	/**
	 * Configuration
	 */
	config: ClientConfig;
}
