import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { Endpoint } from "../api";
import { createModuleClient } from "../client/create-client";
import type { Module } from "../types/module";

function makeModule(id: string, overrides: Partial<Module> = {}): Module {
	return {
		id,
		version: "0.0.1",
		schema: {},
		controllers: {},
		...overrides,
	};
}

function makeConfig() {
	return {
		baseURL: "http://localhost:3000/api",
		queryClient: new QueryClient(),
	};
}

describe("createModuleClient", () => {
	it("throws when accessing a module that does not exist", () => {
		const client = createModuleClient([makeModule("cart")], makeConfig());
		expect(() => client.module("nonexistent")).toThrowError(
			/"nonexistent" not found/,
		);
	});

	it("throws with list of available modules in error message", () => {
		const client = createModuleClient(
			[makeModule("cart"), makeModule("products")],
			makeConfig(),
		);
		expect(() => client.module("billing")).toThrowError(
			/cart.*products|products.*cart/,
		);
	});

	it("returns module accessor without throwing for registered module", () => {
		const client = createModuleClient([makeModule("cart")], makeConfig());
		expect(() => client.module("cart")).not.toThrow();
	});

	it("returns accessor with store and admin properties", () => {
		const client = createModuleClient([makeModule("products")], makeConfig());
		const accessor = client.module("products");
		expect(accessor).toHaveProperty("store");
		expect(accessor).toHaveProperty("admin");
	});

	it("stores the query client on the returned client", () => {
		const qc = new QueryClient();
		const client = createModuleClient([makeModule("cart")], {
			baseURL: "http://localhost:3000",
			queryClient: qc,
		});
		expect(client.queryClient).toBe(qc);
	});

	it("creates a default query client when none is provided", () => {
		const client = createModuleClient([makeModule("cart")], {
			baseURL: "http://localhost:3000",
		});
		expect(client.queryClient).toBeDefined();
		expect(client.queryClient).toBeInstanceOf(QueryClient);
	});

	it("stores the config on the returned client", () => {
		const config = makeConfig();
		const client = createModuleClient([makeModule("cart")], config);
		expect(client.config).toBe(config);
	});

	it("caches module accessor (same reference on second call)", () => {
		const client = createModuleClient([makeModule("cart")], makeConfig());
		const first = client.module("cart");
		const second = client.module("cart");
		expect(first).toBe(second);
	});

	it("handles empty modules array", () => {
		const client = createModuleClient([], makeConfig()) as unknown as {
			module: (id: string) => unknown;
		};
		expect(() => client.module("anything")).toThrow();
	});

	it("handles module with store endpoints", () => {
		const modWithEndpoints: Module = makeModule("shop", {
			endpoints: {
				store: {
					getProducts: {} as unknown as Endpoint,
				},
				admin: {},
			},
		});
		const client = createModuleClient([modWithEndpoints], makeConfig());
		const accessor = client.module("shop");
		expect(accessor.store).toBeDefined();
	});

	it("handles multiple modules independently", () => {
		const cart = makeModule("cart");
		const products = makeModule("products");
		const client = createModuleClient([cart, products], makeConfig());

		expect(() => client.module("cart")).not.toThrow();
		expect(() => client.module("products")).not.toThrow();
		expect(() => client.module("orders")).toThrow();
	});
});
