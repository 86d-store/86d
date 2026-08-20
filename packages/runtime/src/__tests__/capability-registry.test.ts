import {
	acceptCapability,
	defineCapability,
	provideCapability,
} from "@86d-app/core/capabilities";
import type {
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { Module, ModuleDataService } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { describe, expect, it, vi } from "vitest";
import { ModuleRegistry, type ModuleRegistryConfig } from "../registry";

const availabilityV1 = defineCapability({
	name: "inventory.availability",
	version: "1.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string().min(1) }).strict(),
	decision: z.object({ available: z.boolean() }).strict(),
	failure: z
		.object({ code: z.literal("not_found"), message: z.string() })
		.strict(),
});

const availabilityV2 = defineCapability({
	name: "inventory.availability",
	version: "2.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string().min(1) }).strict(),
	decision: z.object({ available: z.boolean(), quantity: z.number() }).strict(),
	failure: z
		.object({ code: z.literal("not_found"), message: z.string() })
		.strict(),
});

const stockAccess = defineCapability({
	name: "inventory.stock-access",
	version: "1.0.0",
	owner: "inventory",
	request: z
		.object({ operation: z.enum(["read", "mutate"]), sku: z.string() })
		.strict(),
	decision: z.object({ operation: z.enum(["read", "mutate"]) }).strict(),
	failure: z.object({ code: z.literal("failed") }).strict(),
});

function dataService(label: string): ModuleDataService & { label: string } {
	return {
		label,
		get: vi.fn().mockResolvedValue(null),
		upsert: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		findMany: vi.fn().mockResolvedValue([]),
	};
}

function unusedTransactionRunner(): ModuleTransactionRunner {
	return {
		async transaction<T>(
			_work: (transaction: ModuleDataTransaction) => Promise<T>,
		): Promise<T> {
			throw new Error("The test transaction runner must not be called.");
		},
	};
}

function config(): ModuleRegistryConfig & {
	resolveStoreId: ReturnType<typeof vi.fn>;
	upsertModuleRecord: ReturnType<typeof vi.fn>;
	createDataService: ReturnType<typeof vi.fn>;
} {
	let nextId = 0;
	return {
		resolveStoreId: vi.fn().mockResolvedValue("store-db-id"),
		upsertModuleRecord: vi.fn().mockImplementation(async ({ moduleId }) => {
			nextId += 1;
			return `${moduleId}-${nextId}`;
		}),
		createDataService: vi
			.fn()
			.mockImplementation(({ moduleDbId }) => dataService(moduleDbId)),
	};
}

function module(id: string, overrides: Partial<Module> = {}): Module {
	return { id, version: "1.0.0", ...overrides };
}

describe("ModuleRegistry capability admission", () => {
	it.each([
		{
			name: "missing",
			modules: [
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
		},
		{
			name: "duplicate",
			modules: [
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: false },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
		},
		{
			name: "incompatible",
			modules: [
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV2)] },
				}),
			],
		},
	])(
		"rejects a $name required capability before initialization effects",
		async ({ modules }) => {
			const adapters = config();
			const registry = new ModuleRegistry(modules, "store-1", adapters);

			await expect(registry.boot()).rejects.toMatchObject({
				name: "CapabilityContractError",
			});
			expect(adapters.resolveStoreId).not.toHaveBeenCalled();
			expect(adapters.upsertModuleRecord).not.toHaveBeenCalled();
			expect(adapters.createDataService).not.toHaveBeenCalled();
		},
	);

	it("allows an absent optional capability and returns explicit unavailability", async () => {
		const registry = new ModuleRegistry(
			[
				module("checkout", {
					capabilities: {
						accepts: [acceptCapability(availabilityV1, { optional: true })],
					},
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const result = await registry
			.createRequestContext("checkout")
			.capabilities.invoke(availabilityV1, { sku: "sku-1" });

		expect(result).toEqual({
			ok: false,
			failure: {
				code: "CAPABILITY_UNAVAILABLE",
				capability: "inventory.availability",
				version: "1.0.0",
			},
		});
	});

	it("rejects an incompatible optional provider before effects", async () => {
		const adapters = config();
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: {
						accepts: [acceptCapability(availabilityV2, { optional: true })],
					},
				}),
			],
			"store-1",
			adapters,
		);

		await expect(registry.boot()).rejects.toMatchObject({
			name: "CapabilityContractError",
		});
		expect(adapters.resolveStoreId).not.toHaveBeenCalled();
	});

	it("rejects duplicate providers even when acceptance is optional", async () => {
		const adapters = config();
		const provider = () =>
			provideCapability(availabilityV1, async () => ({
				ok: true as const,
				decision: { available: true },
			}));
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: { provides: [provider(), provider()] },
				}),
				module("checkout", {
					capabilities: {
						accepts: [acceptCapability(availabilityV1, { optional: true })],
					},
				}),
			],
			"store-1",
			adapters,
		);

		await expect(registry.boot()).rejects.toMatchObject({
			name: "CapabilityContractError",
		});
		expect(adapters.resolveStoreId).not.toHaveBeenCalled();
	});

	it("does not initialize a consumer after its provider fails", async () => {
		const consumerInit = vi.fn();
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
					init: async () => {
						throw new Error("provider failed");
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
					init: consumerInit,
				}),
				module("unrelated"),
			],
			"store-1",
			config(),
		);

		await registry.boot();

		expect(registry.getModuleStatus("inventory")).toBe("error");
		expect(registry.getModuleStatus("checkout")).toBe("error");
		expect(registry.getModuleStatus("unrelated")).toBe("ready");
		expect(consumerInit).not.toHaveBeenCalled();
	});

	it("rejects a provider declared by a module other than its owner", async () => {
		const adapters = config();
		const registry = new ModuleRegistry(
			[
				module("not-inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
			],
			"store-1",
			adapters,
		);

		await expect(registry.boot()).rejects.toMatchObject({
			name: "CapabilityContractError",
		});
		expect(adapters.resolveStoreId).not.toHaveBeenCalled();
	});

	it("rejects duplicate module IDs before initialization effects", async () => {
		const adapters = config();
		const registry = new ModuleRegistry(
			[module("inventory"), module("inventory")],
			"store-1",
			adapters,
		);

		await expect(registry.boot()).rejects.toMatchObject({
			name: "CapabilityContractError",
		});
		expect(adapters.resolveStoreId).not.toHaveBeenCalled();
		expect(adapters.upsertModuleRecord).not.toHaveBeenCalled();
	});

	it("accepts an independently built provider definition with matching metadata", async () => {
		const independentDefinition = defineCapability({
			name: availabilityV1.name,
			version: availabilityV1.version,
			owner: availabilityV1.owner,
			request: availabilityV1.request,
			decision: availabilityV1.decision,
			failure: availabilityV1.failure,
		});
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(independentDefinition, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);

		await expect(registry.boot()).resolves.toBeUndefined();
		await expect(
			registry
				.createRequestContext("checkout")
				.capabilities.invoke(availabilityV1, { sku: "sku-1" }),
		).resolves.toEqual({ ok: true, decision: { available: true } });
	});

	it("rejects a same-name provider owned by someone other than the accepted contract", async () => {
		const spoofedAvailability = defineCapability({
			name: availabilityV1.name,
			version: availabilityV1.version,
			owner: "evil-inventory",
			request: availabilityV1.request,
			decision: availabilityV1.decision,
			failure: availabilityV1.failure,
		});
		const adapters = config();
		const registry = new ModuleRegistry(
			[
				module("evil-inventory", {
					capabilities: {
						provides: [
							provideCapability(spoofedAvailability, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			adapters,
		);

		await expect(registry.boot()).rejects.toMatchObject({
			name: "CapabilityContractError",
		});
		expect(adapters.resolveStoreId).not.toHaveBeenCalled();
	});
});

describe("ModuleRegistry capability invocation", () => {
	it("rejects an operation outside the consumer's accepted authority", async () => {
		const handler = vi.fn(
			async (_ctx, request: { operation: "read" | "mutate" }) => ({
				ok: true as const,
				decision: { operation: request.operation },
			}),
		);
		const limitedAcceptance = {
			...acceptCapability(stockAccess),
			operations: ["read"] as const,
		};
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [provideCapability(stockAccess, handler)],
					},
				}),
				module("reporting", {
					capabilities: { accepts: [limitedAcceptance] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const result = await registry
			.createRequestContext("reporting")
			.capabilities.invoke(stockAccess, { operation: "mutate", sku: "sku-1" });

		expect(result).toEqual({
			ok: false,
			failure: {
				code: "CAPABILITY_OPERATION_NOT_ACCEPTED",
				capability: stockAccess.name,
				version: stockAccess.version,
			},
		});
		expect(handler).not.toHaveBeenCalled();
	});

	it("rejects an undeclared definition object with matching name and version", async () => {
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();
		const lookalike = defineCapability({
			name: availabilityV1.name,
			version: availabilityV1.version,
			owner: availabilityV1.owner,
			request: availabilityV1.request,
			decision: availabilityV1.decision,
			failure: availabilityV1.failure,
		});

		const result = await registry
			.createRequestContext("checkout")
			.capabilities.invoke(lookalike, { sku: "sku-1" });

		expect(result).toEqual({
			ok: false,
			failure: {
				code: "CAPABILITY_NOT_ACCEPTED",
				capability: availabilityV1.name,
				version: availabilityV1.version,
			},
		});
	});

	it("validates input and invokes the provider with only its own data", async () => {
		const handler = vi.fn(async (ctx, request: { sku: string }) => ({
			ok: true as const,
			decision: {
				available:
					(ctx.data as ModuleDataService & { label: string }).label.startsWith(
						"inventory-",
					) && request.sku === "sku-1",
			},
		}));
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [provideCapability(availabilityV1, handler)],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const checkout = registry.createRequestContext("checkout");
		const invalid = await checkout.capabilities.invoke(availabilityV1, {
			sku: "",
		});
		const valid = await checkout.capabilities.invoke(availabilityV1, {
			sku: "sku-1",
		});

		expect(invalid).toMatchObject({
			ok: false,
			failure: { code: "INVALID_CAPABILITY_REQUEST" },
		});
		expect(handler).toHaveBeenCalledTimes(1);
		expect(valid).toEqual({ ok: true, decision: { available: true } });
		expect(
			(checkout.data as ModuleDataService & { label: string }).label,
		).toMatch(/^checkout-/);
	});

	it("keeps both versions invocable when a consumer accepts two of one name", async () => {
		// A consumer migrating between versions accepts both for a while. Binding
		// by capability name alone let the later acceptance overwrite the earlier,
		// so which one survived depended on the order of the accepts array and
		// every invoke of the shadowed version failed as unavailable.
		const v1Handler = vi.fn(async () => ({
			ok: true as const,
			decision: { available: true },
		}));
		const v2Handler = vi.fn(async () => ({
			ok: true as const,
			decision: { available: true, quantity: 4 },
		}));
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, v1Handler),
							provideCapability(availabilityV2, v2Handler),
						],
					},
				}),
				module("checkout", {
					capabilities: {
						accepts: [
							acceptCapability(availabilityV1),
							acceptCapability(availabilityV2),
						],
					},
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();
		const capabilities = registry.createRequestContext("checkout").capabilities;

		const v1 = await capabilities.invoke(availabilityV1, { sku: "sku-1" });
		const v2 = await capabilities.invoke(availabilityV2, { sku: "sku-1" });

		expect(v1).toMatchObject({ ok: true, decision: { available: true } });
		expect(v2).toMatchObject({ ok: true, decision: { quantity: 4 } });
		expect(v1Handler).toHaveBeenCalledTimes(1);
		expect(v2Handler).toHaveBeenCalledTimes(1);
	});

	it("invokes a provider with only its owner's transaction runner", async () => {
		const inventoryTransactions = unusedTransactionRunner();
		const checkoutTransactions = unusedTransactionRunner();
		const handler = vi.fn(async (ctx) => ({
			ok: true as const,
			decision: { available: ctx.transactions === inventoryTransactions },
		}));
		const adapters = config();
		adapters.createTransactionRunner = vi.fn(({ moduleId }) =>
			moduleId === "inventory" ? inventoryTransactions : checkoutTransactions,
		);
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [provideCapability(availabilityV1, handler)],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			adapters,
		);
		await registry.boot();

		const result = await registry
			.createRequestContext("checkout")
			.capabilities.invoke(availabilityV1, { sku: "sku-1" });

		expect(result).toEqual({ ok: true, decision: { available: true } });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("validates provider decisions and failures", async () => {
		const invalidDecision = provideCapability(availabilityV1, async () => {
			const decision = { available: true };
			Object.defineProperty(decision, "available", { value: "yes" });
			return { ok: true, decision };
		});
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: { provides: [invalidDecision] },
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const result = await registry
			.createRequestContext("checkout")
			.capabilities.invoke(availabilityV1, { sku: "sku-1" });

		expect(result).toMatchObject({
			ok: false,
			failure: { code: "INVALID_CAPABILITY_DECISION" },
		});

		const invalidFailure = provideCapability(availabilityV1, async () => {
			const failure = { code: "not_found" as const, message: "Not found" };
			Object.defineProperty(failure, "code", { value: "unexpected" });
			return { ok: false, failure };
		});
		const failureRegistry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: { provides: [invalidFailure] },
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await failureRegistry.boot();

		const failureResult = await failureRegistry
			.createRequestContext("checkout")
			.capabilities.invoke(availabilityV1, { sku: "sku-1" });

		expect(failureResult).toMatchObject({
			ok: false,
			failure: { code: "INVALID_CAPABILITY_FAILURE" },
		});
	});

	it("redacts provider exceptions behind a bounded failure", async () => {
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => {
								throw new Error("database-password=canary-secret");
							}),
						],
					},
				}),
				module("checkout", {
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const result = await registry
			.createRequestContext("checkout")
			.capabilities.invoke(availabilityV1, { sku: "sku-1" });

		expect(result).toEqual({
			ok: false,
			failure: {
				code: "CAPABILITY_PROVIDER_FAILED",
				capability: "inventory.availability",
				version: "1.0.0",
			},
		});
		expect(JSON.stringify(result)).not.toContain("canary-secret");
	});

	it("does not expose provider data or controllers to consumers", async () => {
		const registry = new ModuleRegistry(
			[
				module("inventory", {
					controllers: { inventory: { inspect: async () => "secret" } },
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					controllers: { checkout: { inspect: async () => "local" } },
					capabilities: { accepts: [acceptCapability(availabilityV1)] },
				}),
			],
			"store-1",
			config(),
		);
		await registry.boot();

		const checkout = registry.createRequestContext("checkout");
		expect(checkout.controllers).toEqual({
			checkout: expect.objectContaining({ inspect: expect.any(Function) }),
		});
		expect("inventory" in checkout.controllers).toBe(false);
		expect("_dataRegistry" in checkout).toBe(false);
	});
});
