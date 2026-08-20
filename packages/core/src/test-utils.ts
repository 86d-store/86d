/**
 * @86d-app/core/test-utils
 *
 * Shared test utilities for module authors.
 * Provides a mock ModuleDataService and helpers for constructing
 * ModuleContext objects in tests — without any database dependency.
 *
 * @example
 * ```ts
 * import { createMockDataService, createMockModuleContext } from "@86d-app/core/test-utils";
 *
 * const data = createMockDataService();
 * await data.upsert("product", "p1", { name: "Widget" });
 * const product = await data.get("product", "p1");
 * ```
 */

import type { CapabilityInvoker } from "./capabilities";
import type {
	AnyDurableEventDefinition,
	DurableEventEnvelope,
	DurableEventInput,
	LockingModuleDataTransaction,
	ModuleTransactionRunner,
} from "./durable-events";
import type {
	ModuleConfig,
	ModuleContext,
	ModuleControllers,
	ModuleDataService,
	ModuleEntityMap,
	Session,
} from "./types/module";

// ── Mock Data Service ──────────────────────────────────────────────────────

/**
 * Extended ModuleDataService that exposes the internal store for assertions.
 *
 * @example
 * ```ts
 * const data = createMockDataService();
 * await data.upsert("product", "p1", { name: "Widget" });
 *
 * // Access internal store for assertions
 * expect(data._store.size).toBe(1);
 * data._store.clear(); // reset between tests
 * ```
 */
export interface MockDataService<E extends ModuleEntityMap = ModuleEntityMap>
	extends ModuleDataService<E> {
	/**
	 * Internal store backing the mock. Keys are `${entityType}:${entityId}`.
	 * Exposed for test assertions and manual manipulation.
	 */
	_store: Map<string, Record<string, unknown>>;

	/**
	 * Clear all data from the mock store.
	 * Convenience method — equivalent to `data._store.clear()`.
	 */
	clear(): void;

	/**
	 * Return the number of entities of a given type.
	 */
	size(entityType: string): number;

	/**
	 * Return all stored entities of a given type.
	 */
	all(entityType: string): Record<string, unknown>[];
}

/**
 * Create an in-memory mock of {@link ModuleDataService} for unit tests.
 *
 * Supports:
 * - `get`, `upsert`, `delete` — basic CRUD
 * - `findMany` — with `where` filtering (exact equality), `take`/`skip` pagination
 *
 * The mock uses composite keys (`${entityType}:${entityId}`) internally.
 * All operations are synchronous under the hood but return promises to match
 * the real interface.
 *
 * @example
 * ```ts
 * const data = createMockDataService();
 *
 * // Seed data
 * await data.upsert("product", "p1", { name: "Widget", price: 999 });
 * await data.upsert("product", "p2", { name: "Gadget", price: 1999 });
 *
 * // Query
 * const product = await data.get("product", "p1");
 * const all = await data.findMany("product", { where: { price: 999 } });
 *
 * // Assertions on internal state
 * expect(data.size("product")).toBe(2);
 * ```
 */
export function createMockDataService<
	E extends ModuleEntityMap = ModuleEntityMap,
>(): MockDataService<E> {
	const store = new Map<string, Record<string, unknown>>();

	// The single cast in this file, and the whole cast budget of the entity-typing
	// change: the backing store is deliberately untyped, and the generic surface is
	// re-imposed here at the boundary.
	return {
		_store: store,

		clear() {
			store.clear();
		},

		size(entityType: string): number {
			let count = 0;
			const prefix = `${entityType}:`;
			for (const key of store.keys()) {
				if (key.startsWith(prefix)) count++;
			}
			return count;
		},

		all(entityType: string) {
			const prefix = `${entityType}:`;
			const results: Record<string, unknown>[] = [];
			for (const [key, value] of store.entries()) {
				if (key.startsWith(prefix)) results.push(value);
			}
			return results;
		},

		async get(entityType, entityId) {
			return store.get(`${entityType}:${entityId}`) ?? null;
		},

		async upsert(entityType, entityId, data) {
			store.set(`${entityType}:${entityId}`, data);
		},

		async delete(entityType, entityId) {
			store.delete(`${entityType}:${entityId}`);
		},

		async findMany(entityType, options) {
			const prefix = `${entityType}:`;
			const results: Record<string, unknown>[] = [];

			for (const [key, value] of store.entries()) {
				if (!key.startsWith(prefix)) continue;

				if (options?.where) {
					const matches = Object.entries(options.where).every(
						([k, v]) => v === undefined || value[k] === v,
					);
					if (!matches) continue;
				}

				results.push(value);
			}

			const skip = options?.skip ?? 0;
			const take = options?.take;
			const sliced = results.slice(
				skip,
				take !== undefined ? skip + take : undefined,
			);

			return sliced;
		},
	} as MockDataService<E>;
}

export type MockDurableEvent = Readonly<{
	id: string;
	name: string;
	version: number;
	sourceModule: string;
	aggregate: Readonly<{ type: string; id: string; sequence: number }>;
	payload: unknown;
}>;

export interface MockTransactionRunner extends ModuleTransactionRunner {
	readonly data: MockDataService;
	readonly emitted: MockDurableEvent[];
	transaction<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T>;
}

/**
 * Create an owner-local locking transaction runner for behavior tests.
 *
 * Writes and durable events commit together. A thrown error restores the
 * pre-transaction data snapshot and publishes no event, which lets Module
 * tests characterize atomic failure without mocking their own internals.
 */
export function createMockTransactionRunner(
	options: {
		data?: MockDataService | undefined;
		storeId?: string | undefined;
		beforeEmit?:
			| ((event: MockDurableEvent) => Promise<void> | void)
			| undefined;
	} = {},
): MockTransactionRunner {
	const data = options.data ?? createMockDataService();
	const emitted: MockDurableEvent[] = [];

	return {
		data,
		emitted,
		async transaction(work) {
			const snapshot = new Map(data._store);
			const pending: MockDurableEvent[] = [];
			const transaction: LockingModuleDataTransaction = {
				get: data.get.bind(data),
				findMany: data.findMany.bind(data),
				upsert: data.upsert.bind(data),
				delete: data.delete.bind(data),
				getForUpdate: data.get.bind(data),
				async emit<D extends AnyDurableEventDefinition>(
					definition: D,
					input: DurableEventInput<D>,
				): Promise<DurableEventEnvelope<D>> {
					const sequence =
						pending.filter(
							(event) =>
								event.aggregate.type === input.aggregate.type &&
								event.aggregate.id === input.aggregate.id,
						).length + 1;
					const validation = definition.payload.safeParse(input.payload);
					if (!validation.success) {
						throw new Error("Durable event payload is invalid.");
					}
					const payload = input.payload;
					const event = {
						id: input.id ?? `event-${emitted.length + pending.length + 1}`,
						name: definition.name,
						version: definition.version,
						sourceModule: definition.owner,
						aggregate: { ...input.aggregate, sequence },
						payload,
					} satisfies MockDurableEvent;
					await options.beforeEmit?.(event);
					pending.push(event);
					return {
						...event,
						storeId: options.storeId ?? "test-store",
						occurredAt: input.occurredAt ?? new Date(),
					};
				},
			};

			try {
				const result = await work(transaction);
				emitted.push(...pending);
				return result;
			} catch (error) {
				data._store.clear();
				for (const [key, value] of snapshot) data._store.set(key, value);
				throw error;
			}
		},
	};
}

// ── Mock Module Context ────────────────────────────────────────────────────

/**
 * Options for creating a mock ModuleContext.
 */
export interface MockModuleContextOptions {
	/** Data service to use. Defaults to a fresh `createMockDataService()`. */
	data?: ModuleDataService | undefined;

	/** List of enabled module IDs. Defaults to `[]`. */
	modules?: string[] | undefined;

	/** Module options. Defaults to `{}`. */
	options?: ModuleConfig | undefined;

	/** Authenticated session. Defaults to `null`. */
	session?: Session | null | undefined;

	/** Controller registry. Defaults to `{}`. */
	controllers?: ModuleControllers | undefined;

	/** Capability invoker. Defaults to a bounded not-accepted failure. */
	capabilities?: CapabilityInvoker | undefined;

	/** Store ID. Defaults to `"test-store"`. */
	storeId?: string | undefined;
}

/**
 * Create a mock {@link ModuleContext} for testing module controllers and endpoints.
 *
 * All fields have sensible defaults. Pass overrides for the fields you need.
 *
 * @example
 * ```ts
 * const data = createMockDataService();
 * const ctx = createMockModuleContext({ data, storeId: "store_1" });
 *
 * // Use in controller tests
 * const result = await controllers.product.list({
 *   context: ctx,
 *   params: {},
 *   query: {},
 *   body: {},
 * });
 * ```
 */
export function createMockModuleContext(
	opts: MockModuleContextOptions = {},
): ModuleContext {
	return {
		data: opts.data ?? createMockDataService(),
		modules: opts.modules ?? [],
		options: opts.options ?? {},
		session: opts.session ?? null,
		controllers: opts.controllers ?? {},
		capabilities: opts.capabilities ?? {
			async invoke(definition) {
				return {
					ok: false,
					failure: {
						code: "CAPABILITY_NOT_ACCEPTED",
						capability: definition.name,
						version: definition.version,
					},
				};
			},
		},
		storeId: opts.storeId ?? "test-store",
	};
}

// ── Mock Session ───────────────────────────────────────────────────────────

/**
 * Options for creating a mock Session.
 */
export interface MockSessionOptions {
	/** User ID. Defaults to `"user_test"`. */
	userId?: string | undefined;
	/** User email. Defaults to `"test@example.com"`. */
	email?: string | undefined;
	/** User name. Defaults to `"Test User"`. */
	name?: string | undefined;
	/** User role. Defaults to `"admin"`. */
	role?: string | undefined;
}

/**
 * Create a mock {@link Session} for testing admin endpoints.
 *
 * @example
 * ```ts
 * const session = createMockSession({ role: "admin" });
 * const ctx = createMockModuleContext({ session });
 * ```
 */
export function createMockSession(opts: MockSessionOptions = {}): Session {
	const now = new Date();
	const userId = opts.userId ?? "user_test";
	return {
		session: {
			id: `sess_${userId}`,
			createdAt: now,
			updatedAt: now,
			userId,
			expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
			token: `tok_${userId}`,
		},
		user: {
			id: userId,
			createdAt: now,
			updatedAt: now,
			email: opts.email ?? "test@example.com",
			emailVerified: true,
			name: opts.name ?? "Test User",
			banned: false,
			role: opts.role ?? "admin",
		},
	};
}

// ── Controller Context Builder ─────────────────────────────────────────────

/**
 * Build the `ctx` object that controllers receive from endpoint handlers.
 *
 * This is a convenience for the common test pattern where controllers
 * expect `{ context: { data }, params, query, body }`.
 *
 * @example
 * ```ts
 * const data = createMockDataService();
 * const ctx = makeControllerCtx(data, {
 *   params: { id: "prod_1" },
 *   query: { status: "active" },
 * });
 * const result = await controllers.product.getById(ctx);
 * ```
 */
export function makeControllerCtx(
	dataOrContext: ModuleDataService | ModuleContext,
	opts: {
		params?: Record<string, string> | undefined;
		query?: Record<string, string | undefined> | undefined;
		body?: Record<string, unknown> | undefined;
	} = {},
): {
	context: { data: ModuleDataService } & Record<string, unknown>;
	params: Record<string, string>;
	query: Record<string, string | undefined>;
	body: Record<string, unknown>;
} {
	const isContext =
		"data" in dataOrContext &&
		"modules" in dataOrContext &&
		"storeId" in dataOrContext;

	const context = isContext
		? (dataOrContext as ModuleContext)
		: { data: dataOrContext as ModuleDataService };

	return {
		context: context as { data: ModuleDataService } & Record<string, unknown>,
		params: opts.params ?? {},
		query: opts.query ?? {},
		body: opts.body ?? {},
	};
}
