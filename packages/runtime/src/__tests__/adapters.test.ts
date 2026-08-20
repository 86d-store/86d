import type { BaseAdapter } from "@86d-app/core/adapters";
import { describe, expect, it } from "vitest";
import { AdapterRegistry, createNoOpAdapter } from "../adapters";

function mockAdapter(label: string): BaseAdapter {
	return {
		resource: {
			getData: async () => [label],
		},
	};
}

describe("AdapterRegistry", () => {
	it("registers and retrieves an adapter", () => {
		const registry = new AdapterRegistry();
		const adapter = mockAdapter("products");
		registry.register("products", adapter);
		expect(registry.get("products")).toBe(adapter);
	});

	it("returns undefined for unregistered module", () => {
		const registry = new AdapterRegistry();
		expect(registry.get("nonexistent")).toBeUndefined();
	});

	it("reports whether a module is registered", () => {
		const registry = new AdapterRegistry();
		registry.register("cart", mockAdapter("cart"));
		expect(registry.has("cart")).toBe(true);
		expect(registry.has("orders")).toBe(false);
	});

	it("returns all adapters as a plain object", () => {
		const registry = new AdapterRegistry();
		const a1 = mockAdapter("a");
		const a2 = mockAdapter("b");
		registry.register("mod-a", a1);
		registry.register("mod-b", a2);
		const all = registry.getAll();
		expect(all["mod-a"]).toBe(a1);
		expect(all["mod-b"]).toBe(a2);
		expect(Object.keys(all)).toHaveLength(2);
	});

	it("clears all adapters", () => {
		const registry = new AdapterRegistry();
		registry.register("x", mockAdapter("x"));
		registry.clear();
		expect(registry.has("x")).toBe(false);
		expect(Object.keys(registry.getAll())).toHaveLength(0);
	});

	it("overwrites adapter on duplicate register", () => {
		const registry = new AdapterRegistry();
		const first = mockAdapter("v1");
		const second = mockAdapter("v2");
		registry.register("mod", first);
		registry.register("mod", second);
		expect(registry.get("mod")).toBe(second);
	});
});

describe("createNoOpAdapter", () => {
	it("throws when any method is called", () => {
		const adapter = createNoOpAdapter("shipping");
		const resource = adapter.calculate as unknown as () => void;
		expect(() => resource()).toThrow(
			'no adapter is registered for module "shipping"',
		);
	});

	it("includes the method name in the error message", () => {
		const adapter = createNoOpAdapter("tax");
		const method = adapter.getRates as unknown as () => void;
		expect(() => method()).toThrow('Adapter method "getRates"');
	});

	it("returns undefined for symbol properties", () => {
		const adapter = createNoOpAdapter("test");
		expect(
			(adapter as unknown as Record<symbol, unknown>)[Symbol.toPrimitive],
		).toBeUndefined();
	});
});
