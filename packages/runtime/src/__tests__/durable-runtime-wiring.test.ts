import type { ModuleTransactionRunner } from "@86d-app/core/durable-events";
import type { Module, ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it, vi } from "vitest";
import type { ModuleRegistryConfig } from "../registry";
import { ModuleRegistry } from "../registry";

function dataService(): ModuleDataService {
	return {
		get: vi.fn().mockResolvedValue(null),
		upsert: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		findMany: vi.fn().mockResolvedValue([]),
	};
}

function transactionRunner(): ModuleTransactionRunner {
	return { transaction: vi.fn() };
}

function config(
	overrides?: Partial<ModuleRegistryConfig>,
): ModuleRegistryConfig {
	return {
		resolveStoreId: vi.fn().mockResolvedValue("store-uuid-123"),
		upsertModuleRecord: vi
			.fn()
			.mockImplementation(({ moduleId }: { moduleId: string }) =>
				Promise.resolve(`db-uuid-for-${moduleId}`),
			),
		createDataService: vi.fn().mockImplementation(() => dataService()),
		...overrides,
	};
}

function moduleNamed(id: string, overrides?: Partial<Module>): Module {
	return { id, version: "1.0.0", ...overrides };
}

describe("durable runtime wiring", () => {
	describe("Module identity at the data-service seam", () => {
		it("passes the logical Module ID alongside its persisted UUID", async () => {
			const createDataService = vi.fn().mockImplementation(() => dataService());
			const registry = new ModuleRegistry(
				[moduleNamed("inventory")],
				"store-1",
				config({ createDataService }),
			);

			await registry.boot();

			expect(createDataService).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "inventory",
				moduleDbId: "db-uuid-for-inventory",
			});
		});

		it("never substitutes the persisted UUID for the logical Module ID", async () => {
			const seen: Array<{ moduleId: string; moduleDbId: string }> = [];
			const registry = new ModuleRegistry(
				[moduleNamed("inventory"), moduleNamed("audit-log")],
				"store-1",
				config({
					createDataService: vi.fn().mockImplementation((params) => {
						seen.push({
							moduleId: params.moduleId,
							moduleDbId: params.moduleDbId,
						});
						return dataService();
					}),
				}),
			);

			await registry.boot();

			expect(seen).toEqual([
				{ moduleId: "inventory", moduleDbId: "db-uuid-for-inventory" },
				{ moduleId: "audit-log", moduleDbId: "db-uuid-for-audit-log" },
			]);
			for (const entry of seen) {
				expect(entry.moduleId).not.toBe(entry.moduleDbId);
			}
		});
	});

	describe("ModuleContext.transactions", () => {
		it("populates the owner-local transaction runner on request contexts", async () => {
			const runner = transactionRunner();
			const createTransactionRunner = vi.fn().mockReturnValue(runner);
			const registry = new ModuleRegistry(
				[moduleNamed("inventory")],
				"store-1",
				config({ createTransactionRunner }),
			);

			await registry.boot();

			expect(createTransactionRunner).toHaveBeenCalledWith({
				storeId: "store-uuid-123",
				moduleId: "inventory",
				moduleDbId: "db-uuid-for-inventory",
			});
			expect(registry.createRequestContext("inventory").transactions).toBe(
				runner,
			);
		});

		it("populates the transaction runner during init", async () => {
			const runner = transactionRunner();
			const init = vi.fn().mockResolvedValue(undefined);
			const registry = new ModuleRegistry(
				[moduleNamed("inventory", { init })],
				"store-1",
				config({ createTransactionRunner: vi.fn().mockReturnValue(runner) }),
			);

			await registry.boot();

			expect(registry.getModuleStatus("inventory")).toBe("ready");
			expect(init).toHaveBeenCalledWith(
				expect.objectContaining({ transactions: runner }),
			);
		});

		it("leaves transactions undefined when the host provides no runner", async () => {
			const registry = new ModuleRegistry(
				[moduleNamed("inventory")],
				"store-1",
				config(),
			);

			await registry.boot();

			expect(
				registry.createRequestContext("inventory").transactions,
			).toBeUndefined();
		});

		it("gives each Module its own runner and never another Module's", async () => {
			const runners = new Map<string, ModuleTransactionRunner>();
			const registry = new ModuleRegistry(
				[moduleNamed("inventory"), moduleNamed("audit-log")],
				"store-1",
				config({
					createTransactionRunner: vi
						.fn()
						.mockImplementation(({ moduleId }: { moduleId: string }) => {
							const runner = transactionRunner();
							runners.set(moduleId, runner);
							return runner;
						}),
				}),
			);

			await registry.boot();

			expect(registry.createRequestContext("inventory").transactions).toBe(
				runners.get("inventory"),
			);
			expect(registry.createRequestContext("audit-log").transactions).toBe(
				runners.get("audit-log"),
			);
			expect(runners.get("inventory")).not.toBe(runners.get("audit-log"));
		});
	});
});
