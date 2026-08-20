import { describe, expect, it } from "vitest";
import type {
	Module,
	ModuleConfig,
	ModuleController,
	ModuleControllers,
	ModuleDataService,
} from "../types/module";

/**
 * Tests for core module type contracts.
 * These verify runtime shape conformance that TypeScript alone can't guarantee.
 */

describe("Module shape", () => {
	it("creates a valid minimal module", () => {
		const mod: Module = {
			id: "test-module",
			version: "0.0.1",
			schema: {},
			controllers: {},
			endpoints: { store: {}, admin: {} },
		};
		expect(mod.id).toBe("test-module");
		expect(mod.version).toBe("0.0.1");
	});

	it("module can have optional properties undefined", () => {
		const mod: Module = {
			id: "minimal",
			version: "1.0.0",
			schema: {},
			controllers: {},
		};
		expect(mod.endpoints).toBeUndefined();
		expect(mod.options).toBeUndefined();
		expect(mod.hooks).toBeUndefined();
	});

	it("module id is a string", () => {
		const mod: Module = {
			id: "products",
			version: "0.1.0",
			schema: {},
			controllers: {},
		};
		expect(typeof mod.id).toBe("string");
	});

	it("module schema accepts an empty object", () => {
		const mod: Module = {
			id: "empty",
			version: "0.0.1",
			schema: {},
			controllers: {},
		};
		expect(mod.schema).toEqual({});
	});
});

describe("ModuleController shape", () => {
	it("controller methods can have any parameter signatures", () => {
		const controller: ModuleController = {
			getById: async (id: string) => ({ id }),
			findAll: async () => [],
			create: async (data: Record<string, unknown>) => data,
			count: async () => 0,
		};
		expect(typeof controller.getById).toBe("function");
		expect(typeof controller.findAll).toBe("function");
	});

	it("controllers record maps string keys to ModuleController", () => {
		const controllers: ModuleControllers = {
			cart: {
				getCart: async (id: string) => ({ id }),
			},
			products: {
				getProduct: async (id: string) => ({ id }),
			},
		};
		expect(Object.keys(controllers)).toHaveLength(2);
		expect(typeof controllers.cart.getCart).toBe("function");
	});
});

describe("ModuleConfig shape", () => {
	it("accepts flat primitive values", () => {
		const config: ModuleConfig = {
			maxItems: 100,
			enabled: true,
			name: "test",
			nothing: null,
		};
		expect(config.maxItems).toBe(100);
		expect(config.enabled).toBe(true);
	});

	it("accepts empty config", () => {
		const config: ModuleConfig = {};
		expect(Object.keys(config)).toHaveLength(0);
	});
});

describe("ModuleDataService interface", () => {
	it("can be implemented with a plain object", () => {
		const mockData: ModuleDataService = {
			get: async (_entityType, _entityId) => ({ id: _entityId }),
			upsert: async (_entityType, _entityId, _data) => {},
			delete: async (_entityType, _entityId) => {},
			findMany: async (_entityType, _options) => [],
		};

		expect(typeof mockData.get).toBe("function");
		expect(typeof mockData.upsert).toBe("function");
		expect(typeof mockData.delete).toBe("function");
		expect(typeof mockData.findMany).toBe("function");
	});

	it("get returns null when entity not found (mock)", async () => {
		const mockData: ModuleDataService = {
			get: async () => null,
			upsert: async () => {},
			delete: async () => {},
			findMany: async () => [],
		};

		const result = await mockData.get("product", "nonexistent");
		expect(result).toBeNull();
	});

	it("findMany returns empty array when no results (mock)", async () => {
		const mockData: ModuleDataService = {
			get: async () => null,
			upsert: async () => {},
			delete: async () => {},
			findMany: async () => [],
		};

		const results = await mockData.findMany("cart", {
			where: { status: "active" },
		});
		expect(results).toEqual([]);
	});
});
