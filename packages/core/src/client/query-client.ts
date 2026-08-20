import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

/**
 * Create a new QueryClient with sensible defaults for SSR
 */
export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 30 * 1000,
			},
			dehydrate: {
				serializeData: SuperJSON.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
				shouldRedactErrors: () => {
					// We should not catch Next.js server errors
					// as that's how Next.js detects dynamic pages
					// so we cannot redact them.
					// Next.js also automatically redacts errors for us
					// with better digests.
					return false;
				},
			},
			hydrate: {
				deserializeData: SuperJSON.deserialize,
			},
		},
	});

let clientQueryClientSingleton: QueryClient | undefined;

/**
 * Get the QueryClient singleton
 * On server: always creates a new client
 * On browser: uses singleton pattern
 */
export const getQueryClient = () => {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return createQueryClient();
	}
	// Browser: use singleton pattern to keep the same query client
	clientQueryClientSingleton ??= createQueryClient();

	return clientQueryClientSingleton;
};
