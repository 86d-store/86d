import { ModuleRegistry } from "@86d-app/runtime/registry";
import { describe, expect, it, vi } from "vitest";
import { modules } from "../../generated/api";

function createBootConfig() {
	let dbIdCounter = 0;
	return {
		resolveStoreId: vi.fn().mockResolvedValue("store-boot-smoke"),
		upsertModuleRecord: vi.fn().mockImplementation(async () => {
			dbIdCounter += 1;
			return `mod-db-${dbIdCounter}`;
		}),
		createDataService: vi.fn().mockReturnValue({
			get: vi.fn().mockResolvedValue(null),
			upsert: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			findMany: vi.fn().mockResolvedValue([]),
			runTransaction: vi.fn(),
		}),
		createTransactionRunner: vi.fn().mockReturnValue({
			runTransaction: vi.fn(),
		}),
	};
}

describe("Store Runtime module registry boot smoke", () => {
	it("boots the generated Brisa module composition without capability contract failures", async () => {
		const registry = new ModuleRegistry(
			modules,
			"store-boot-smoke",
			createBootConfig(),
		);

		await expect(registry.boot()).resolves.toBeUndefined();
		expect(registry.isReady()).toBe(true);
		expect(registry.getModuleIds().length).toBeGreaterThan(0);
		expect(registry.getModuleStatus("checkout")).toBe("ready");
		expect(registry.getModuleStatus("tax")).toBe("ready");
		expect(registry.getModuleStatus("orders")).toBe("ready");
		expect(registry.getModuleStatus("fulfillment")).toBe("ready");
	});
});
