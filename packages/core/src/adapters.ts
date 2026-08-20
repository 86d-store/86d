import type { Awaitable } from "./types/helper";

/**
 * Base adapter interface that all module adapters should extend.
 * Adapters are structured as objects with resource keys (e.g., "cart", "product")
 * where each resource contains async methods.
 *
 * @example
 * // Example of an adapter implementing BaseAdapter
 * const myAdapter: BaseAdapter = {
 *   cart: {
 *     getById: async (id: string) => {
 *       // implementation here
 *     },
 *     create: async (data: any) => {
 *       // implementation here
 *     }
 *   },
 *   product: {
 *     list: async () => {
 *       // implementation here
 *     }
 *   }
 * };
 */
export interface BaseAdapter {
	[resource: string]: {
		// biome-ignore lint/suspicious/noExplicitAny: adapter methods have varying parameter signatures
		[method: string]: (...args: any[]) => Awaitable<any>;
	};
}
