import type {
	Module,
	ModuleContext,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { describe, expect, it, vi } from "vitest";
import type { ModuleRegistryConfig } from "../registry";
import { ModuleRegistry } from "../registry";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockDataService(): ModuleDataService {
	return {
		get: vi.fn().mockResolvedValue(null),
		upsert: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		findMany: vi.fn().mockResolvedValue([]),
	};
}

function createMockConfig(
	overrides?: Partial<ModuleRegistryConfig>,
): ModuleRegistryConfig {
	let dbIdCounter = 0;
	return {
		resolveStoreId: vi.fn().mockResolvedValue("store-uuid-123"),
		upsertModuleRecord: vi.fn().mockImplementation(() => {
			dbIdCounter++;
			return Promise.resolve(`mod-db-${dbIdCounter}`);
		}),
		createDataService: vi
			.fn()
			.mockImplementation(() => createMockDataService()),
		...overrides,
	};
}

function createMinimalModule(id: string, overrides?: Partial<Module>): Module {
	return {
		id,
		version: "1.0.0",
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ModuleRegistry", () => {
	describe("constructor", () => {
		it("registers all modules as pending", () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			expect(registry.getModuleStatus("products")).toBe("pending");
			expect(registry.getModuleStatus("cart")).toBe("pending");
			expect(registry.getModuleIds()).toEqual(["products", "cart"]);
		});

		it("returns undefined for unknown module status", () => {
			const registry = new ModuleRegistry([], "store-1", createMockConfig());
			expect(registry.getModuleStatus("nonexistent")).toBeUndefined();
		});
	});

	describe("boot", () => {
		it("resolves store ID via config", async () => {
			const config = createMockConfig();
			const registry = new ModuleRegistry(
				[createMinimalModule("products")],
				"my-store-slug",
				config,
			);

			await registry.boot();

			expect(config.resolveStoreId).toHaveBeenCalledWith("my-store-slug");
		});

		it("upserts module records for each module", async () => {
			const config = createMockConfig();
			const modules = [
				createMinimalModule("products", { options: { featured: true } }),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(modules, "store-1", config);

			await registry.boot();

			expect(config.upsertModuleRecord).toHaveBeenCalledTimes(2);
			expect(config.upsertModuleRecord).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "products",
				version: "1.0.0",
				options: { featured: true },
			});
			expect(config.upsertModuleRecord).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "cart",
				version: "1.0.0",
				options: undefined,
			});
		});

		it("creates data services for each module", async () => {
			const config = createMockConfig();
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(modules, "store-1", config);

			await registry.boot();

			expect(config.createDataService).toHaveBeenCalledTimes(2);
			// The logical Module ID and the persisted row UUID are distinct values
			// and both are supplied; the durable-event source identity depends on it.
			expect(config.createDataService).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "products",
				moduleDbId: "mod-db-1",
			});
			expect(config.createDataService).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "cart",
				moduleDbId: "mod-db-2",
			});
		});

		it("transitions modules to ready status", async () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			expect(registry.getModuleStatus("products")).toBe("ready");
			expect(registry.getModuleStatus("cart")).toBe("ready");
			expect(registry.isReady()).toBe(true);
		});

		it("calls module init functions", async () => {
			const initFn = vi.fn().mockResolvedValue(undefined);
			const modules = [createMinimalModule("products", { init: initFn })];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			expect(initFn).toHaveBeenCalledTimes(1);
			const ctx = initFn.mock.calls[0][0];
			expect(ctx.storeId).toBe("store-uuid-123");
			expect(ctx.modules).toEqual(["products"]);
			expect(ctx.data).toBeDefined();
			expect(ctx.events).toBeDefined();
		});

		it("merges controllers returned from init", async () => {
			const modules = [
				createMinimalModule("products", {
					init: async () => ({
						controllers: {
							product: {
								getProduct: async () => ({ id: "p1" }),
							},
						},
					}),
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			const controllers = registry.getControllers();
			expect(controllers.product).toBeDefined();
			expect(typeof controllers.product.getProduct).toBe("function");
		});

		it("merges static controllers from module definition", async () => {
			const modules = [
				createMinimalModule("products", {
					controllers: {
						product: {
							list: async () => [],
						},
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			const controllers = registry.getControllers();
			expect(typeof controllers.product.list).toBe("function");
		});

		it("does not expose another module's controllers during init", async () => {
			const cartInit = vi.fn().mockResolvedValue(undefined);
			const modules = [
				createMinimalModule("products", {
					controllers: {
						product: { getProduct: async () => ({ id: "p1" }) },
					},
				}),
				createMinimalModule("cart", { init: cartInit }),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			const ctx = cartInit.mock.calls[0][0];
			expect(ctx.controllers.product).toBeUndefined();
			expect(ctx.controllers).toEqual({});
		});

		it("is a no-op on second call", async () => {
			const config = createMockConfig();
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(modules, "store-1", config);

			await registry.boot();
			await registry.boot();

			expect(config.resolveStoreId).toHaveBeenCalledTimes(1);
			expect(config.upsertModuleRecord).toHaveBeenCalledTimes(1);
		});

		it("throws on contract violations", async () => {
			const modules = [
				createMinimalModule("checkout", {
					requires: {
						discounts: {
							read: ["discountAmount"],
						},
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await expect(registry.boot()).rejects.toThrow(
				"Module contract violations",
			);
		});

		it("throws on duplicate module paths before resolving the store", async () => {
			const config = createMockConfig();
			const modules = [
				createMinimalModule("products", {
					admin: {
						pages: [
							{ path: "/admin/collections", component: "CollectionsAdmin" },
						],
					},
				}),
				createMinimalModule("collections", {
					admin: {
						pages: [
							{ path: "/admin/collections", component: "CollectionAdmin" },
						],
					},
				}),
			];
			const registry = new ModuleRegistry(modules, "store-1", config);

			await expect(registry.boot()).rejects.toThrow("Module path conflicts");
			expect(config.resolveStoreId).not.toHaveBeenCalled();
		});

		it("initializes dependencies before dependents via topological sort", async () => {
			const modules = [
				createMinimalModule("cart", {
					requires: ["products"],
				}),
				createMinimalModule("products", {
					exports: { read: ["productTitle"] },
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			// Boot reorders modules so products initializes before cart
			await registry.boot();
			expect(registry.getModuleStatus("cart")).toBe("ready");
			expect(registry.getModuleStatus("products")).toBe("ready");
		});

		it("throws when ALL modules fail to initialize", async () => {
			const modules = [
				createMinimalModule("products", {
					init: async () => {
						throw new Error("Init failed!");
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await expect(registry.boot()).rejects.toThrow(
				"All modules failed to initialize",
			);
			expect(registry.getModuleStatus("products")).toBe("error");
		});

		it("skips module whose dependency failed", async () => {
			const modules = [
				createMinimalModule("products", {
					init: async () => {
						throw new Error("Init failed!");
					},
				}),
				createMinimalModule("cart", {
					requires: ["products"],
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await expect(registry.boot()).rejects.toThrow(
				"All modules failed to initialize",
			);
			expect(registry.getModuleStatus("products")).toBe("error");
			expect(registry.getModuleStatus("cart")).toBe("error");
		});

		it("wires event handlers declared on modules", async () => {
			const handler = vi.fn();
			const modules = [
				createMinimalModule("orders", {
					events: {
						emits: ["order.placed"],
						handles: {
							"payment.completed": handler,
						},
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			const bus = registry.getEventBus();
			expect(bus).toBeDefined();
			// Emit an event to verify the handler was wired
			await bus?.emit("payment.completed", "payments", { orderId: "o1" });
			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	describe("createRequestContext", () => {
		it("throws if registry is not booted", () => {
			const registry = new ModuleRegistry(
				[createMinimalModule("products")],
				"store-1",
				createMockConfig(),
			);

			expect(() => registry.createRequestContext("products")).toThrow(
				"not been booted",
			);
		});

		it("returns context with session", async () => {
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const session = {
				session: {
					id: "sess-1",
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: "user-1",
					expiresAt: new Date(),
					token: "tok",
				},
				user: {
					id: "user-1",
					createdAt: new Date(),
					updatedAt: new Date(),
					email: "a@b.com",
					emailVerified: true,
					name: "Test",
					banned: false,
				},
			};

			const ctx = registry.createRequestContext("products", session);

			expect(ctx.session).toBe(session);
			expect(ctx.storeId).toBe("store-uuid-123");
			expect(ctx.modules).toEqual(["products"]);
			expect(ctx.data).toBeDefined();
			expect(ctx.controllers).toBeDefined();
			expect(ctx.events).toBeDefined();
		});

		it("returns context with null session for unauthenticated requests", async () => {
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const ctx = registry.createRequestContext("products", null);
			expect(ctx.session).toBeNull();
		});

		it("exposes only the requested module data service", async () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const products = registry.createRequestContext("products");
			const cart = registry.createRequestContext("cart");
			expect(products.data).not.toBe(cart.data);
			expect("_dataRegistry" in products).toBe(false);
			expect("_dataRegistry" in cart).toBe(false);
		});

		it("uses the requested module data service", async () => {
			const ds1 = createMockDataService();
			const ds2 = createMockDataService();
			let callCount = 0;
			const config = createMockConfig({
				createDataService: vi.fn().mockImplementation(() => {
					callCount++;
					return callCount === 1 ? ds1 : ds2;
				}),
			});
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(modules, "store-1", config);
			await registry.boot();

			const ctx = registry.createRequestContext("cart");
			expect(ctx.data).toBe(ds2);
		});

		it("shares controllers across requests", async () => {
			const modules = [
				createMinimalModule("products", {
					controllers: {
						product: { list: async () => [] },
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const ctx1 = registry.createRequestContext("products");
			const ctx2 = registry.createRequestContext("products");
			expect(ctx1.controllers).toBe(ctx2.controllers);
		});

		it("throws if registry is shutting down", async () => {
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();
			await registry.shutdown();

			expect(() => registry.createRequestContext("products")).toThrow();
		});
	});

	describe("shutdown", () => {
		it("calls module shutdown hooks in reverse order", async () => {
			const shutdownOrder: string[] = [];
			const modules = [
				createMinimalModule("products", {
					shutdown: async () => {
						shutdownOrder.push("products");
					},
				}),
				createMinimalModule("cart", {
					shutdown: async () => {
						shutdownOrder.push("cart");
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			await registry.shutdown();

			expect(shutdownOrder).toEqual(["cart", "products"]);
		});

		it("transitions modules to stopped status", async () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			await registry.shutdown();

			expect(registry.getModuleStatus("products")).toBe("stopped");
			expect(registry.getModuleStatus("cart")).toBe("stopped");
			expect(registry.isReady()).toBe(false);
		});

		it("is a no-op when not booted", async () => {
			const modules = [
				createMinimalModule("products", {
					shutdown: vi.fn(),
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			// Should not throw
			await registry.shutdown();
			expect(modules[0].shutdown).not.toHaveBeenCalled();
		});

		it("is a no-op on second call", async () => {
			const shutdownFn = vi.fn();
			const modules = [
				createMinimalModule("products", { shutdown: shutdownFn }),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			await registry.shutdown();
			await registry.shutdown();

			expect(shutdownFn).toHaveBeenCalledTimes(1);
		});

		it("swallows shutdown errors", async () => {
			const modules = [
				createMinimalModule("products", {
					shutdown: async () => {
						throw new Error("Cleanup failed");
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			// Should not throw
			await expect(registry.shutdown()).resolves.toBeUndefined();
			expect(registry.getModuleStatus("products")).toBe("stopped");
		});

		it("skips modules that are not ready", async () => {
			const shutdownFn = vi.fn();
			const modules = [
				createMinimalModule("products", {
					init: async () => {
						throw new Error("Init fail");
					},
					shutdown: shutdownFn,
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			try {
				await registry.boot();
			} catch {
				// expected
			}

			await registry.shutdown();
			expect(shutdownFn).not.toHaveBeenCalled();
		});

		it("removes all event listeners", async () => {
			const handler = vi.fn();
			const modules = [
				createMinimalModule("orders", {
					events: {
						handles: { "payment.completed": handler },
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const bus = registry.getEventBus();
			expect(bus).toBeDefined();
			await registry.shutdown();

			// Emitting after shutdown should not trigger handler
			await bus?.emit("payment.completed", "payments", {});
			expect(handler).toHaveBeenCalledTimes(0);
		});
	});

	describe("getHealth", () => {
		it("returns booting status before boot", () => {
			const registry = new ModuleRegistry(
				[createMinimalModule("products")],
				"store-1",
				createMockConfig(),
			);

			const health = registry.getHealth();
			expect(health.status).toBe("booting");
			expect(health.bootedAt).toBeUndefined();
			expect(health.uptimeMs).toBeUndefined();
			expect(health.modules).toEqual([
				{ id: "products", status: "pending", error: undefined },
			]);
		});

		it("returns ready status after boot", async () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart"),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const health = registry.getHealth();
			expect(health.status).toBe("ready");
			expect(health.bootedAt).toBeTypeOf("number");
			expect(health.uptimeMs).toBeTypeOf("number");
			expect(health.modules).toEqual([
				{ id: "products", status: "ready", error: undefined },
				{ id: "cart", status: "ready", error: undefined },
			]);
		});

		it("returns error status when a module has errors but boot succeeds", async () => {
			const modules = [
				createMinimalModule("products"),
				createMinimalModule("cart", {
					init: async () => {
						throw new Error("Init failed");
					},
				}),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			// Boot succeeds: products is ready, cart is error
			await registry.boot();

			const health = registry.getHealth();
			expect(health.status).toBe("error");
			expect(health.modules[0]).toEqual({
				id: "products",
				status: "ready",
				error: undefined,
			});
			expect(health.modules[1]).toEqual({
				id: "cart",
				status: "error",
				error: "Init failed",
			});
		});

		it("returns stopped status after shutdown", async () => {
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();
			await registry.shutdown();

			const health = registry.getHealth();
			expect(health.status).toBe("stopped");
		});
	});

	describe("module options", () => {
		it("passes only current module options to request context", async () => {
			const modules = [createMinimalModule("products")];
			const opts = { products: { pageSize: 20 } };
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
				opts,
			);
			await registry.boot();

			const ctx = registry.createRequestContext("products");
			expect(ctx.options).toEqual({ pageSize: 20 });
		});

		it("defaults to empty options", async () => {
			const modules = [createMinimalModule("products")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);
			await registry.boot();

			const ctx = registry.createRequestContext("products");
			expect(ctx.options).toEqual({});
		});
	});

	describe("edge cases", () => {
		it("handles zero modules", async () => {
			const registry = new ModuleRegistry([], "store-1", createMockConfig());

			// Zero modules means nothing to initialize — throws
			await expect(registry.boot()).rejects.toThrow(
				"All modules failed to initialize",
			);
			expect(registry.getModuleIds()).toEqual([]);
		});

		it("handles modules with no init, no controllers, no events", async () => {
			const modules = [createMinimalModule("simple")];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig(),
			);

			await registry.boot();

			expect(registry.getModuleStatus("simple")).toBe("ready");
			const ctx = registry.createRequestContext("simple");
			expect(ctx.data).toBeDefined();
		});

		it("does not propagate init context additions to another module", async () => {
			const providerData = createMockDataService();
			const consumerInit = vi.fn();
			let dataServiceCall = 0;
			const maliciousInit = (async (ctx: ModuleContext) => ({
				context: { canaryDataService: ctx.data },
			})) as Module["init"];
			const modules = [
				createMinimalModule("products", {
					// Simulate untyped third-party JavaScript returning obsolete metadata.
					init: maliciousInit,
				}),
				createMinimalModule("cart", { init: consumerInit }),
			];
			const registry = new ModuleRegistry(
				modules,
				"store-1",
				createMockConfig({
					createDataService: vi.fn().mockImplementation(() => {
						dataServiceCall += 1;
						return dataServiceCall === 1
							? providerData
							: createMockDataService();
					}),
				}),
			);

			await registry.boot();

			const consumerContext = consumerInit.mock
				.calls[0]?.[0] as ModuleContext & {
				canaryDataService?: ModuleDataService;
			};
			expect(consumerContext.canaryDataService).toBeUndefined();
			expect(consumerContext.data).not.toBe(providerData);
		});

		it("scopes options to the owning module in init and request contexts", async () => {
			const providerInit = vi.fn();
			const consumerInit = vi.fn();
			const registry = new ModuleRegistry(
				[
					createMinimalModule("provider", { init: providerInit }),
					createMinimalModule("consumer", { init: consumerInit }),
				],
				"store-1",
				createMockConfig(),
				{
					provider: { apiKey: "provider-canary", visible: true },
					consumer: { pageSize: 20 },
				},
			);

			await registry.boot();

			expect(providerInit.mock.calls[0]?.[0].options).toEqual({
				apiKey: "provider-canary",
				visible: true,
			});
			expect(consumerInit.mock.calls[0]?.[0].options).toEqual({ pageSize: 20 });
			expect(
				JSON.stringify(registry.createRequestContext("consumer").options),
			).not.toContain("provider-canary");
		});
	});
});
