import type { BaseAdapter } from "@86d-app/core/adapters";

/**
 * Adapter registry that holds all module adapters
 */
export class AdapterRegistry {
	private adapters: Map<string, BaseAdapter> = new Map();

	/**
	 * Register an adapter for a module
	 */
	register(moduleId: string, adapter: BaseAdapter): void {
		this.adapters.set(moduleId, adapter);
	}

	/**
	 * Get an adapter by module ID
	 */
	get(moduleId: string): BaseAdapter | undefined {
		return this.adapters.get(moduleId);
	}

	/**
	 * Get all registered adapters as an object
	 */
	getAll(): Record<string, BaseAdapter> {
		return Object.fromEntries(this.adapters.entries());
	}

	/**
	 * Check if an adapter is registered
	 */
	has(moduleId: string): boolean {
		return this.adapters.has(moduleId);
	}

	/**
	 * Clear all adapters
	 */
	clear(): void {
		this.adapters.clear();
	}
}

/**
 * Default no-op adapter for development
 * Throws errors when methods are called to indicate missing implementation
 */
export function createNoOpAdapter(moduleId: string): BaseAdapter {
	return new Proxy(
		{},
		{
			get: (_target, prop) => {
				if (typeof prop === "string") {
					return () => {
						throw new Error(
							`Adapter method "${prop}" called but no adapter is registered for module "${moduleId}". ` +
								`Please provide an adapter implementation.`,
						);
					};
				}
				return undefined;
			},
		},
	);
}
