import { describe, expect, it, vi } from "vitest";
import {
	createEventBus,
	createScopedEmitter,
	type EventBus,
	type EventHandler,
	type ModuleEvent,
} from "../events";

describe("createEventBus", () => {
	describe("emit", () => {
		it("calls registered handlers with correct event shape", async () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("order.placed", handler);

			await bus.emit("order.placed", "orders", { orderId: "ord_1" });

			expect(handler).toHaveBeenCalledOnce();
			const event = handler.mock.calls[0][0] as ModuleEvent;
			expect(event.type).toBe("order.placed");
			expect(event.source).toBe("orders");
			expect(event.payload).toEqual({ orderId: "ord_1" });
			expect(typeof event.timestamp).toBe("number");
		});

		it("calls multiple handlers for the same event type", async () => {
			const bus = createEventBus();
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			bus.on("order.placed", handler1);
			bus.on("order.placed", handler2);

			await bus.emit("order.placed", "orders", { orderId: "ord_1" });

			expect(handler1).toHaveBeenCalledOnce();
			expect(handler2).toHaveBeenCalledOnce();
		});

		it("does not call handlers for different event types", async () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("order.placed", handler);

			await bus.emit("payment.completed", "payments", {});

			expect(handler).not.toHaveBeenCalled();
		});

		it("resolves immediately when no handlers are registered", async () => {
			const bus = createEventBus();
			await expect(bus.emit("nothing", "test", {})).resolves.toBeUndefined();
		});

		it("handles async handlers", async () => {
			const bus = createEventBus();
			const results: string[] = [];

			bus.on("test", async () => {
				await new Promise((r) => setTimeout(r, 10));
				results.push("async-done");
			});

			await bus.emit("test", "source", {});
			expect(results).toEqual(["async-done"]);
		});

		it("runs handlers concurrently", async () => {
			const bus = createEventBus();
			const start = Date.now();
			const delays: number[] = [];

			bus.on("test", async () => {
				await new Promise((r) => setTimeout(r, 50));
				delays.push(Date.now() - start);
			});
			bus.on("test", async () => {
				await new Promise((r) => setTimeout(r, 50));
				delays.push(Date.now() - start);
			});

			await bus.emit("test", "source", {});

			// Both handlers should complete roughly at the same time (concurrent)
			// If sequential, second would be ~100ms. With concurrency, both ~50ms.
			expect(delays).toHaveLength(2);
			const d0 = delays[0] ?? 0;
			const d1 = delays[1] ?? 0;
			expect(d1 - d0).toBeLessThan(30);
		});
	});

	describe("error handling", () => {
		it("catches handler errors and calls onError", async () => {
			const onError = vi.fn();
			const bus = createEventBus({ onError });
			const error = new Error("handler failed");

			bus.on("test", () => {
				throw error;
			});

			await bus.emit("test", "source", { data: 1 });

			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBe(error);
			expect(onError.mock.calls[0][1].type).toBe("test");
			expect(onError.mock.calls[0][1].source).toBe("source");
		});

		it("catches async handler rejections", async () => {
			const onError = vi.fn();
			const bus = createEventBus({ onError });

			bus.on("test", async () => {
				throw new Error("async failure");
			});

			await bus.emit("test", "source", {});

			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
		});

		it("one failing handler does not prevent others from running", async () => {
			const onError = vi.fn();
			const bus = createEventBus({ onError });
			const successHandler = vi.fn();

			bus.on("test", () => {
				throw new Error("fail");
			});
			bus.on("test", successHandler);

			await bus.emit("test", "source", {});

			expect(onError).toHaveBeenCalledOnce();
			expect(successHandler).toHaveBeenCalledOnce();
		});

		it("uses console.error as default error handler", async () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			const bus = createEventBus();

			bus.on("test", () => {
				throw new Error("oops");
			});

			await bus.emit("test", "source", {});

			expect(spy).toHaveBeenCalledOnce();
			expect(spy.mock.calls[0][0]).toContain("[EventBus]");
			spy.mockRestore();
		});
	});

	describe("on / off", () => {
		it("returns an unsubscribe function", async () => {
			const bus = createEventBus();
			const handler = vi.fn();
			const unsub = bus.on("test", handler);

			await bus.emit("test", "source", {});
			expect(handler).toHaveBeenCalledOnce();

			unsub();
			await bus.emit("test", "source", {});
			expect(handler).toHaveBeenCalledOnce(); // not called again
		});

		it("off removes a specific handler", async () => {
			const bus = createEventBus();
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			bus.on("test", handler1);
			bus.on("test", handler2);

			bus.off("test", handler1);
			await bus.emit("test", "source", {});

			expect(handler1).not.toHaveBeenCalled();
			expect(handler2).toHaveBeenCalledOnce();
		});

		it("off is a no-op for unknown handler", () => {
			const bus = createEventBus();
			expect(() => bus.off("test", vi.fn())).not.toThrow();
		});

		it("off is a no-op for unknown event type", () => {
			const bus = createEventBus();
			expect(() => bus.off("nonexistent", vi.fn())).not.toThrow();
		});

		it("cleans up empty handler sets after off", () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("test", handler);
			expect(bus.listenerCount("test")).toBe(1);

			bus.off("test", handler);
			expect(bus.listenerCount("test")).toBe(0);
		});
	});

	describe("removeAllListeners", () => {
		it("removes all handlers for a specific type", async () => {
			const bus = createEventBus();
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			bus.on("test", handler1);
			bus.on("test", handler2);
			bus.on("other", vi.fn());

			bus.removeAllListeners("test");

			expect(bus.listenerCount("test")).toBe(0);
			expect(bus.listenerCount("other")).toBe(1);
		});

		it("removes all handlers when no type specified", () => {
			const bus = createEventBus();
			bus.on("a", vi.fn());
			bus.on("b", vi.fn());
			bus.on("c", vi.fn());

			bus.removeAllListeners();

			expect(bus.listenerCount()).toBe(0);
		});
	});

	describe("listenerCount", () => {
		it("returns 0 when no handlers are registered", () => {
			const bus = createEventBus();
			expect(bus.listenerCount()).toBe(0);
			expect(bus.listenerCount("test")).toBe(0);
		});

		it("returns count for a specific type", () => {
			const bus = createEventBus();
			bus.on("test", vi.fn());
			bus.on("test", vi.fn());
			bus.on("other", vi.fn());

			expect(bus.listenerCount("test")).toBe(2);
			expect(bus.listenerCount("other")).toBe(1);
		});

		it("returns total count across all types when no type specified", () => {
			const bus = createEventBus();
			bus.on("a", vi.fn());
			bus.on("b", vi.fn());
			bus.on("c", vi.fn());

			expect(bus.listenerCount()).toBe(3);
		});
	});

	describe("edge cases", () => {
		it("same handler can be registered only once per type", async () => {
			const bus = createEventBus();
			const handler = vi.fn();

			bus.on("test", handler);
			bus.on("test", handler);

			await bus.emit("test", "source", {});
			// Set-based storage means handler is only registered once
			expect(handler).toHaveBeenCalledOnce();
		});

		it("same handler can listen on different types", async () => {
			const bus = createEventBus();
			const handler = vi.fn();

			bus.on("a", handler);
			bus.on("b", handler);

			await bus.emit("a", "source", { x: 1 });
			await bus.emit("b", "source", { x: 2 });

			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("handles empty string event type", async () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("", handler);

			await bus.emit("", "source", {});
			expect(handler).toHaveBeenCalledOnce();
		});

		it("preserves handler order (Set insertion order)", async () => {
			const bus = createEventBus();
			const order: number[] = [];

			bus.on("test", () => {
				order.push(1);
			});
			bus.on("test", () => {
				order.push(2);
			});
			bus.on("test", () => {
				order.push(3);
			});

			await bus.emit("test", "source", {});
			// Concurrent execution, but all start in order
			expect(order).toEqual([1, 2, 3]);
		});
	});
});

describe("createScopedEmitter", () => {
	let bus: EventBus;

	function setup() {
		bus = createEventBus();
		return bus;
	}

	it("auto-sets source module ID on emit", async () => {
		setup();
		const handler = vi.fn();
		bus.on("order.placed", handler);

		const emitter = createScopedEmitter(bus, "orders");
		await emitter.emit("order.placed", { orderId: "ord_1" });

		const event = handler.mock.calls[0][0] as ModuleEvent;
		expect(event.source).toBe("orders");
		expect(event.payload).toEqual({ orderId: "ord_1" });
	});

	it("delegates on() to the underlying bus", async () => {
		setup();
		const emitter = createScopedEmitter(bus, "orders");
		const handler = vi.fn();

		emitter.on("test", handler);

		await bus.emit("test", "other-module", {});
		expect(handler).toHaveBeenCalledOnce();
	});

	it("returns unsubscribe from on()", async () => {
		setup();
		const emitter = createScopedEmitter(bus, "orders");
		const handler = vi.fn();

		const unsub = emitter.on("test", handler);
		unsub();

		await bus.emit("test", "other-module", {});
		expect(handler).not.toHaveBeenCalled();
	});

	it("delegates off() to the underlying bus", async () => {
		setup();
		const emitter = createScopedEmitter(bus, "orders");
		const handler = vi.fn();

		emitter.on("test", handler);
		emitter.off("test", handler);

		await bus.emit("test", "other-module", {});
		expect(handler).not.toHaveBeenCalled();
	});

	it("different modules can have independent scoped emitters", async () => {
		setup();
		const handler = vi.fn();
		bus.on("test", handler);

		const ordersEmitter = createScopedEmitter(bus, "orders");
		const paymentsEmitter = createScopedEmitter(bus, "payments");

		await ordersEmitter.emit("test", { from: "orders" });
		await paymentsEmitter.emit("test", { from: "payments" });

		expect(handler).toHaveBeenCalledTimes(2);
		expect((handler.mock.calls[0][0] as ModuleEvent).source).toBe("orders");
		expect((handler.mock.calls[1][0] as ModuleEvent).source).toBe("payments");
	});

	it("scoped emitter can subscribe and receive events from other modules", async () => {
		setup();
		const receivedEvents: ModuleEvent[] = [];

		const ordersEmitter = createScopedEmitter(bus, "orders");
		const inventoryEmitter = createScopedEmitter(bus, "inventory");

		// Inventory listens for order events
		inventoryEmitter.on("order.placed", (event) => {
			receivedEvents.push(event);
		});

		// Orders emits
		await ordersEmitter.emit("order.placed", { orderId: "ord_1" });

		expect(receivedEvents).toHaveLength(1);
		expect(receivedEvents[0].source).toBe("orders");
		expect(receivedEvents[0].payload).toEqual({ orderId: "ord_1" });
	});
});

describe("Module event declarations integration", () => {
	it("wires module.events.handles to the bus", async () => {
		const bus = createEventBus();
		const handled: ModuleEvent[] = [];

		// Simulate what the runtime does: wire module event handlers
		const inventoryHandles: Record<string, EventHandler> = {
			"order.placed": async (event) => {
				handled.push(event);
			},
		};

		for (const [eventType, handler] of Object.entries(inventoryHandles)) {
			bus.on(eventType, handler);
		}

		// Orders module emits
		await bus.emit("order.placed", "orders", { orderId: "ord_1" });

		expect(handled).toHaveLength(1);
		expect(handled[0].source).toBe("orders");
	});

	it("multiple modules can handle the same event", async () => {
		const bus = createEventBus();
		const inventoryHandled: string[] = [];
		const analyticsHandled: string[] = [];

		// Inventory module handler
		bus.on("order.placed", (event) => {
			inventoryHandled.push(event.source);
		});

		// Analytics module handler
		bus.on("order.placed", (event) => {
			analyticsHandled.push(event.source);
		});

		await bus.emit("order.placed", "orders", { orderId: "ord_1" });

		expect(inventoryHandled).toEqual(["orders"]);
		expect(analyticsHandled).toEqual(["orders"]);
	});

	it("module emits events are optional metadata, do not affect emit", async () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on("surprise.event", handler);

		// Even without declaring "emits", a module can emit any event
		// (emits is documentation/validation, not enforcement)
		const emitter = createScopedEmitter(bus, "rogue-module");
		await emitter.emit("surprise.event", {});

		expect(handler).toHaveBeenCalledOnce();
	});

	it("full lifecycle: declare, wire, emit, handle", async () => {
		const bus = createEventBus();
		const results: string[] = [];

		// Simulate module definitions
		const ordersModule = {
			id: "orders",
			events: {
				emits: ["order.placed", "order.fulfilled"],
			},
		};

		const inventoryModule = {
			id: "inventory",
			events: {
				handles: {
					"order.placed": async (event: ModuleEvent) => {
						results.push(
							`inventory received order.placed from ${event.source}`,
						);
					},
				},
			},
		};

		const emailModule = {
			id: "emails",
			events: {
				handles: {
					"order.placed": async (event: ModuleEvent) => {
						results.push(`emails received order.placed from ${event.source}`);
					},
					"order.fulfilled": async (event: ModuleEvent) => {
						results.push(
							`emails received order.fulfilled from ${event.source}`,
						);
					},
				},
			},
		};

		// Runtime wires handlers
		const allModules = [ordersModule, inventoryModule, emailModule];
		for (const mod of allModules) {
			const events = mod.events as
				| { handles?: Record<string, EventHandler> }
				| undefined;
			if (events?.handles) {
				for (const [type, handler] of Object.entries(events.handles)) {
					bus.on(type, handler);
				}
			}
		}

		// Orders module emits events
		const ordersEmitter = createScopedEmitter(bus, ordersModule.id);
		await ordersEmitter.emit("order.placed", {
			orderId: "ord_1",
			total: 99.99,
		});
		await ordersEmitter.emit("order.fulfilled", {
			orderId: "ord_1",
		});

		expect(results).toEqual([
			"inventory received order.placed from orders",
			"emails received order.placed from orders",
			"emails received order.fulfilled from orders",
		]);
	});
});
