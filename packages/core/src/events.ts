/**
 * In-process event bus for inter-module communication.
 *
 * Modules emit domain events (e.g., "order.placed", "payment.completed")
 * and other modules subscribe to react. Handlers run asynchronously;
 * errors are caught and reported via an optional error callback so a
 * failing subscriber never breaks the emitter.
 *
 * @example
 * ```ts
 * const bus = createEventBus();
 * bus.on("order.placed", async (event) => {
 *   console.log("Order placed:", event.payload);
 * });
 * await bus.emit("order.placed", "orders", { orderId: "ord_123" });
 * ```
 */

/**
 * An event emitted by a module.
 */
export interface ModuleEvent<T = unknown> {
	/** Dot-namespaced event type, e.g. "order.placed" */
	type: string;
	/** Module ID that emitted the event */
	source: string;
	/** Unix timestamp (ms) when the event was created */
	timestamp: number;
	/** Event-specific data */
	payload: T;
}

/**
 * Handler function for a module event.
 */
export type EventHandler<T = unknown> = (
	event: ModuleEvent<T>,
) => Promise<void> | void;

/**
 * Callback invoked when an event handler throws.
 */
export type EventErrorHandler = (
	error: unknown,
	event: ModuleEvent,
	handler: EventHandler,
) => void;

/**
 * Options for creating an EventBus.
 */
export interface EventBusOptions {
	/** Called when a handler throws. Defaults to console.error. */
	onError?: EventErrorHandler | undefined;
}

/**
 * In-process pub/sub event bus.
 */
export interface EventBus {
	/**
	 * Emit an event to all registered handlers.
	 * Handlers run concurrently; errors are caught and reported.
	 * Resolves after all handlers have settled.
	 */
	emit<T = unknown>(type: string, source: string, payload: T): Promise<void>;

	/**
	 * Register a handler for an event type. Returns an unsubscribe function.
	 */
	on<T = unknown>(type: string, handler: EventHandler<T>): () => void;

	/**
	 * Remove a specific handler for an event type.
	 */
	off(type: string, handler: EventHandler): void;

	/**
	 * Remove all handlers, optionally scoped to a specific event type.
	 */
	removeAllListeners(type?: string | undefined): void;

	/**
	 * Count of handlers, optionally scoped to a specific event type.
	 */
	listenerCount(type?: string | undefined): number;
}

/**
 * A module-scoped emitter that automatically sets the `source` field.
 * Provided to modules via `ModuleContext.events`.
 */
export interface ScopedEventEmitter {
	/**
	 * Emit an event from this module.
	 * The `source` is automatically set to the module ID.
	 */
	emit<T = unknown>(type: string, payload: T): Promise<void>;

	/**
	 * Subscribe to an event type. Returns an unsubscribe function.
	 */
	on<T = unknown>(type: string, handler: EventHandler<T>): () => void;

	/**
	 * Unsubscribe a handler from an event type.
	 */
	off(type: string, handler: EventHandler): void;
}

/**
 * Create a new EventBus instance.
 *
 * @example
 * ```ts
 * const bus = createEventBus({
 *   onError: (err, event) => logger.error("Event handler failed", { event: event.type, err }),
 * });
 * ```
 */
export function createEventBus(
	options?: EventBusOptions | undefined,
): EventBus {
	const handlers = new Map<string, Set<EventHandler>>();

	const defaultOnError: EventErrorHandler = (error, event) => {
		console.error(
			`[EventBus] Handler error for event "${event.type}" from "${event.source}":`,
			error,
		);
	};

	const onError = options?.onError ?? defaultOnError;

	function getOrCreateSet(type: string): Set<EventHandler> {
		let set = handlers.get(type);
		if (!set) {
			set = new Set();
			handlers.set(type, set);
		}
		return set;
	}

	const bus: EventBus = {
		async emit<T = unknown>(
			type: string,
			source: string,
			payload: T,
		): Promise<void> {
			const event: ModuleEvent<T> = {
				type,
				source,
				timestamp: Date.now(),
				payload,
			};

			const typeHandlers = handlers.get(type);
			if (!typeHandlers || typeHandlers.size === 0) {
				return;
			}

			// Run all handlers concurrently, catching errors individually
			const promises = [...typeHandlers].map(async (handler) => {
				try {
					await handler(event as ModuleEvent);
				} catch (err) {
					onError(err, event as ModuleEvent, handler);
				}
			});

			await Promise.all(promises);
		},

		on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
			const set = getOrCreateSet(type);
			set.add(handler as EventHandler);
			return () => {
				set.delete(handler as EventHandler);
			};
		},

		off(type: string, handler: EventHandler): void {
			const set = handlers.get(type);
			if (set) {
				set.delete(handler);
				if (set.size === 0) {
					handlers.delete(type);
				}
			}
		},

		removeAllListeners(type?: string | undefined): void {
			if (type) {
				handlers.delete(type);
			} else {
				handlers.clear();
			}
		},

		listenerCount(type?: string | undefined): number {
			if (type) {
				return handlers.get(type)?.size ?? 0;
			}
			let count = 0;
			for (const set of handlers.values()) {
				count += set.size;
			}
			return count;
		},
	};

	return bus;
}

/**
 * Create a module-scoped event emitter that auto-sets the source module ID.
 *
 * @example
 * ```ts
 * const emitter = createScopedEmitter(bus, "orders");
 * await emitter.emit("order.placed", { orderId: "ord_123" });
 * // event.source === "orders"
 * ```
 */
export function createScopedEmitter(
	bus: EventBus,
	moduleId: string,
): ScopedEventEmitter {
	return {
		async emit<T = unknown>(type: string, payload: T): Promise<void> {
			await bus.emit(type, moduleId, payload);
		},

		on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
			return bus.on(type, handler);
		},

		off(type: string, handler: EventHandler): void {
			bus.off(type, handler);
		},
	};
}
