import {
	type QueryClient,
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import type { ClientConfig, MutationHook, QueryHook } from "./types";

/**
 * Error thrown by module client when an HTTP request fails.
 * Carries the HTTP status code and the parsed JSON response body.
 */
export class ModuleClientError extends Error {
	readonly status: number;
	body: Record<string, unknown> | undefined;

	constructor(status: number, statusText: string) {
		super(`HTTP ${status}: ${statusText}`);
		this.name = "ModuleClientError";
		this.status = status;
	}
}

interface HookOptions {
	path: string;
	method: string;
	moduleId: string;
	namespace: "store" | "admin";
	config: ClientConfig;
	queryClient: QueryClient;
}

/**
 * Build the full URL for an endpoint
 */
function buildUrl(
	baseURL: string,
	path: string,
	params?: Record<string, string>,
	query?: Record<string, unknown>,
): string {
	let url = path;

	// Replace path params
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			url = url.replace(`:${key}`, encodeURIComponent(value));
		}
	}

	// When baseURL is relative, treat absolute path as segment under base so /api + /cart/get -> /api/cart/get
	const base = baseURL.startsWith("http")
		? baseURL
		: `http://localhost${baseURL.endsWith("/") ? baseURL : `${baseURL}/`}`;
	if (!baseURL.startsWith("http") && url.startsWith("/")) {
		url = url.slice(1);
	}

	// Build full URL
	const fullUrl = new URL(url, base);

	// Add query params
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== null) {
				fullUrl.searchParams.set(key, String(value));
			}
		}
	}

	// Return relative path if baseURL was relative
	if (!baseURL.startsWith("http")) {
		return fullUrl.pathname + fullUrl.search;
	}

	return fullUrl.toString();
}

/**
 * Get headers from config
 */
async function getHeaders(
	config: ClientConfig,
): Promise<Record<string, string>> {
	if (!config.headers) {
		return {};
	}
	if (typeof config.headers === "function") {
		return await config.headers();
	}
	return config.headers;
}

/**
 * Create a query key for caching
 */
function createQueryKey(
	moduleId: string,
	namespace: string,
	path: string,
	// biome-ignore lint/suspicious/noExplicitAny: query key can be any serializable value
	input?: any,
): readonly unknown[] {
	const key = [moduleId, namespace, path];
	if (input !== undefined && input !== null) {
		key.push(input);
	}
	return key;
}

/**
 * Create a fetch function for the endpoint
 */
function createFetchFn(options: HookOptions) {
	const { path, method, config } = options;

	// biome-ignore lint/suspicious/noExplicitAny: generic fetch function accepts any input and returns any response
	return async (input?: any): Promise<any> => {
		const headers = await getHeaders(config);
		const isBodyMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

		// Extract params and body/query from input, omitting an undefined params key
		const params = input?.params;
		const withoutUndefinedParams = (value: typeof input) => {
			if (value == null || value.params !== undefined) return value;
			const { params: _params, ...rest } = value;
			return rest;
		};
		const body = isBodyMethod
			? withoutUndefinedParams(params ? { ...input, params: undefined } : input)
			: undefined;
		const query = !isBodyMethod
			? withoutUndefinedParams(params ? { ...input, params: undefined } : input)
			: undefined;

		const url = buildUrl(config.baseURL, path, params, query);

		const fetchOptions: RequestInit = {
			method,
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
		};

		if (config.credentials) {
			fetchOptions.credentials = config.credentials;
		}

		if (isBodyMethod) {
			fetchOptions.body =
				body && Object.keys(body).length > 0 ? JSON.stringify(body) : "{}";
		}

		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			const error = new ModuleClientError(response.status, response.statusText);
			try {
				error.body = (await response.json()) as Record<string, unknown>;
			} catch {
				// Ignore JSON parse errors
			}
			config.onError?.(error);
			throw error;
		}

		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			return response.json();
		}

		return response.text();
	};
}

/**
 * Create a query hook for GET endpoints
 */
// biome-ignore lint/suspicious/noExplicitAny: default type params allow flexible usage without explicit types
export function createQueryHook<TInput = any, TOutput = any>(
	options: HookOptions,
): QueryHook<TInput, TOutput> {
	const { moduleId, namespace, path, queryClient } = options;
	const fetchFn = createFetchFn(options);

	return {
		useQuery: (
			input?: TInput,
			queryOptions?: Omit<UseQueryOptions<TOutput>, "queryKey" | "queryFn">,
		) => {
			const queryKey = createQueryKey(moduleId, namespace, path, input);
			return useQuery({
				queryKey,
				queryFn: () => fetchFn(input),
				...queryOptions,
			});
		},

		invalidate: async (input?: TInput) => {
			const queryKey = createQueryKey(moduleId, namespace, path, input);
			await queryClient.invalidateQueries({ queryKey });
		},

		prefetch: async (input?: TInput) => {
			const queryKey = createQueryKey(moduleId, namespace, path, input);
			await queryClient.prefetchQuery({
				queryKey,
				queryFn: () => fetchFn(input),
			});
		},

		getQueryKey: (input?: TInput) => {
			return createQueryKey(moduleId, namespace, path, input);
		},

		fetch: fetchFn,
	};
}

/**
 * Create a mutation hook for POST/PUT/DELETE endpoints
 */
// biome-ignore lint/suspicious/noExplicitAny: default type params allow flexible usage without explicit types
export function createMutationHook<TInput = any, TOutput = any>(
	options: HookOptions,
): MutationHook<TInput, TOutput> {
	const { moduleId, namespace, path } = options;
	const fetchFn = createFetchFn(options);

	return {
		useMutation: (
			mutationOptions?: Omit<
				UseMutationOptions<TOutput, Error, TInput>,
				"mutationFn"
			>,
		) => {
			return useMutation({
				mutationFn: fetchFn,
				...mutationOptions,
			});
		},

		mutate: fetchFn,

		getMutationKey: () => {
			return [moduleId, namespace, path];
		},
	};
}
