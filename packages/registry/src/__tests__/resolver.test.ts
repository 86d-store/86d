import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readStoreConfig } from "../config.js";
import {
	detectCircularDependencies,
	getLocalModuleNames,
	getModuleDependencies,
	readLocalManifest,
	resolveModules,
} from "../resolver.js";
import type {
	RegistryManifest,
	RegistryModule,
	StoreConfig,
} from "../types.js";

/** Build a manifest entry with the fields every entry now carries. */
function registryEntry(
	entry: Omit<
		RegistryModule,
		| "maturity"
		| "maturityEvidence"
		| "providesCapabilities"
		| "acceptsCapabilities"
		| "emitsDurableEvents"
		| "handlesDurableEvents"
	>,
): RegistryModule {
	return {
		maturity: "experimental",
		maturityEvidence: [],
		providesCapabilities: [],
		acceptsCapabilities: [],
		emitsDurableEvents: [],
		handlesDurableEvents: [],
		...entry,
	};
}

const TMP_ROOT = join(import.meta.dirname, ".tmp-resolver-test");

beforeAll(() => {
	// Create a fake project structure
	mkdirSync(join(TMP_ROOT, "modules", "products", "src"), {
		recursive: true,
	});
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "package.json"),
		JSON.stringify({ name: "@86d-app/products", version: "0.0.1" }),
	);

	mkdirSync(join(TMP_ROOT, "modules", "cart", "src"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "modules", "cart", "package.json"),
		JSON.stringify({ name: "@86d-app/cart", version: "0.0.1" }),
	);

	mkdirSync(join(TMP_ROOT, "modules", "blog", "src"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "modules", "blog", "package.json"),
		JSON.stringify({ name: "@86d-app/blog", version: "0.0.1" }),
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

const testManifest: RegistryManifest = {
	version: 1,
	baseUrl: "https://github.com/86d-app/86d",
	defaultRef: "main",
	templates: {},
	modules: {
		products: registryEntry({
			name: "@86d-app/products",
			description: "Product catalog",
			version: "0.0.1",
			category: "catalog",
			path: "modules/products",
			requires: [],
			hasStoreComponents: true,
			hasAdminComponents: true,
			hasStorePages: true,
		}),
		cart: registryEntry({
			name: "@86d-app/cart",
			description: "Shopping cart",
			version: "0.0.1",
			category: "sales",
			path: "modules/cart",
			requires: [],
			hasStoreComponents: true,
			hasAdminComponents: true,
			hasStorePages: false,
		}),
		shipping: registryEntry({
			name: "@86d-app/shipping",
			description: "Shipping rates",
			version: "0.0.1",
			category: "fulfillment",
			path: "modules/shipping",
			requires: [],
			hasStoreComponents: false,
			hasAdminComponents: true,
			hasStorePages: false,
		}),
	},
};

describe("resolveModules", () => {
	it.each([
		["omitted selection", {}],
		["wildcard selection", { modules: "*" }],
		[
			"wildcard selection with a global opt-in",
			{
				modules: "*",
				advanced: { version: 1, allowExperimentalModules: true },
			},
		],
	] satisfies Array<[string, StoreConfig]>)(
		"does not admit Experimental Modules from %s",
		async (_label, config) => {
			const results = await resolveModules(config, {
				root: TMP_ROOT,
				manifest: testManifest,
			});

			expect(results).toHaveLength(4);
			expect(results.every((result) => result.status === "error")).toBe(true);
			expect(
				results.every((result) => result.error?.includes("explicitly named")),
			).toBe(true);
		},
	);

	it("denies explicitly selected Experimental Modules without advanced opt-in", async () => {
		const config: StoreConfig = {
			modules: ["@86d-app/products", "@86d-app/cart"],
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results).toHaveLength(2);
		expect(results.every((result) => result.status === "error")).toBe(true);
		expect(
			results.every((result) => result.error?.includes("advanced opt-in")),
		).toBe(true);
		expect(
			results.every((result) => result.error?.includes("advanced.version")),
		).toBe(true);
	});

	it("admits explicitly selected Experimental Modules with versioned advanced opt-in", async () => {
		const config: StoreConfig = {
			modules: ["@86d-app/products", "@86d-app/cart"],
			advanced: { version: 1, allowExperimentalModules: true },
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results.map((result) => result.status)).toEqual(["found", "found"]);
		expect(results.map((result) => result.specifier.name)).toEqual([
			"products",
			"cart",
		]);
	});

	it("rejects an unsupported advanced opt-in version from JSON config", async () => {
		const configPath = join(TMP_ROOT, "unsupported-advanced-config.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				modules: ["@86d-app/products"],
				advanced: { version: 2, allowExperimentalModules: true },
			}),
		);
		const results = await resolveModules(readStoreConfig(configPath), {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual(
			expect.objectContaining({
				status: "error",
				error: expect.stringContaining("advanced.version to 1"),
			}),
		);
	});

	it("admits a Stable Module from wildcard discovery without advanced opt-in", async () => {
		const products = testManifest.modules.products;
		if (!products) throw new Error("products fixture is missing");
		const manifest: RegistryManifest = {
			...testManifest,
			modules: {
				...testManifest.modules,
				products: {
					...products,
					maturity: "stable",
					maturityEvidence: [
						{
							kind: "production-smoke",
							reference: "test-fixture:products-production-smoke",
							recordedAt: "2026-08-13T00:00:00.000Z",
							version: products.version,
						},
					],
				},
			},
		};

		const results = await resolveModules(
			{ modules: "*" },
			{ root: TMP_ROOT, manifest },
		);

		expect(
			results.find((result) => result.specifier.name === "products"),
		).toEqual(expect.objectContaining({ status: "found" }));
	});

	it("marks unknown modules as missing", async () => {
		const config: StoreConfig = {
			modules: ["@86d-app/unknown-module"],
			advanced: { version: 1, allowExperimentalModules: true },
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results.length).toBe(1);
		expect(results[0].status).toBe("missing");
		expect(results[0].error).toContain("not found");
		expect(results[0].error).toContain("Check the specifier");
		expect(results[0].error).not.toContain("advanced opt-in");
	});

	it("blocks explicitly selected Deprecated Modules with transition guidance", async () => {
		const cart = testManifest.modules.cart;
		if (!cart) throw new Error("cart fixture is missing");
		const manifest: RegistryManifest = {
			...testManifest,
			modules: {
				...testManifest.modules,
				cart: { ...cart, maturity: "deprecated" },
			},
		};
		const results = await resolveModules(
			{ modules: ["@86d-app/cart"] },
			{ root: TMP_ROOT, manifest },
		);

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual(
			expect.objectContaining({
				status: "error",
				error: expect.stringContaining("documented transition"),
			}),
		);
	});

	it("resolves bare names", async () => {
		const config: StoreConfig = {
			modules: ["products"],
			advanced: { version: 1, allowExperimentalModules: true },
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results.length).toBe(1);
		expect(results[0].status).toBe("found");
		expect(results[0].specifier.source).toBe("local");
	});

	it("parses GitHub specifiers", async () => {
		const config: StoreConfig = {
			modules: ["github:owner/repo/modules/custom"],
			advanced: { version: 1, allowExperimentalModules: true },
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results.length).toBe(1);
		expect(results[0].specifier.source).toBe("github");
		expect(results[0].specifier.repo).toBe("owner/repo");
		expect(results[0].status).toBe("missing");
	});

	it("parses npm specifiers", async () => {
		const config: StoreConfig = {
			modules: ["npm:@acme/commerce-module"],
			advanced: { version: 1, allowExperimentalModules: true },
		};
		const results = await resolveModules(config, {
			root: TMP_ROOT,
			manifest: testManifest,
		});

		expect(results.length).toBe(1);
		expect(results[0].specifier.source).toBe("npm");
		expect(results[0].status).toBe("missing");
	});
});

describe("getLocalModuleNames", () => {
	it("returns sorted local module names", () => {
		const names = getLocalModuleNames(TMP_ROOT);
		expect(names).toEqual(["blog", "cart", "products"]);
	});

	it("returns empty array for non-existent root", () => {
		const names = getLocalModuleNames("/non/existent/path");
		expect(names).toEqual([]);
	});
});

describe("readLocalManifest", () => {
	it("reads a valid registry.json", () => {
		const manifestPath = join(TMP_ROOT, "registry.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				version: 1,
				baseUrl: "https://github.com/86d-app/86d",
				defaultRef: "main",
				modules: {},
				templates: {},
			}),
		);
		const result = readLocalManifest(manifestPath);
		expect(result).toBeDefined();
		expect(result?.version).toBe(1);
	});

	it("returns undefined for non-existent file", () => {
		const result = readLocalManifest("/non/existent/registry.json");
		expect(result).toBeUndefined();
	});

	it("returns undefined for invalid JSON", () => {
		const badPath = join(TMP_ROOT, "bad-registry.json");
		writeFileSync(badPath, "not json{{{");
		const result = readLocalManifest(badPath);
		expect(result).toBeUndefined();
	});

	it("returns undefined for valid JSON that fails schema validation", () => {
		const invalidPath = join(TMP_ROOT, "invalid-registry.json");
		writeFileSync(invalidPath, JSON.stringify({ version: 999, modules: {} }));
		const result = readLocalManifest(invalidPath);
		expect(result).toBeUndefined();
	});
});

describe("getModuleDependencies", () => {
	const depManifest: RegistryManifest = {
		version: 1,
		baseUrl: "https://github.com/86d-app/86d",
		defaultRef: "main",
		templates: {},
		modules: {
			products: registryEntry({
				name: "@86d-app/products",
				description: "Products",
				version: "0.0.1",
				category: "catalog",
				path: "modules/products",
				requires: [],
				hasStoreComponents: true,
				hasAdminComponents: true,
				hasStorePages: true,
			}),
			cart: registryEntry({
				name: "@86d-app/cart",
				description: "Cart",
				version: "0.0.1",
				category: "sales",
				path: "modules/cart",
				requires: ["products"],
				hasStoreComponents: true,
				hasAdminComponents: true,
				hasStorePages: false,
			}),
			checkout: registryEntry({
				name: "@86d-app/checkout",
				description: "Checkout",
				version: "0.0.1",
				category: "sales",
				path: "modules/checkout",
				requires: ["cart", "products"],
				hasStoreComponents: true,
				hasAdminComponents: true,
				hasStorePages: true,
			}),
			orders: registryEntry({
				name: "@86d-app/orders",
				description: "Orders",
				version: "0.0.1",
				category: "sales",
				path: "modules/orders",
				requires: ["checkout"],
				hasStoreComponents: false,
				hasAdminComponents: true,
				hasStorePages: false,
			}),
		},
	};

	it("returns empty array for module with no dependencies", () => {
		const deps = getModuleDependencies("products", depManifest);
		expect(deps).toEqual([]);
	});

	it("returns direct dependencies", () => {
		const deps = getModuleDependencies("cart", depManifest);
		expect(deps).toEqual(["products"]);
	});

	it("returns transitive dependencies in order", () => {
		const deps = getModuleDependencies("checkout", depManifest);
		// products first (leaf), then cart
		expect(deps).toEqual(["products", "cart"]);
	});

	it("returns deep transitive dependencies", () => {
		const deps = getModuleDependencies("orders", depManifest);
		// products, cart, checkout — all before orders
		expect(deps).toEqual(["products", "cart", "checkout"]);
	});

	it("returns empty array for unknown module", () => {
		const deps = getModuleDependencies("nonexistent", depManifest);
		expect(deps).toEqual([]);
	});

	it("returns empty array when manifest is undefined", () => {
		const deps = getModuleDependencies("products", undefined);
		expect(deps).toEqual([]);
	});

	it("throws on circular dependencies", () => {
		const circularManifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				a: registryEntry({
					name: "@86d-app/a",
					description: "A",
					version: "0.0.1",
					category: "general",
					path: "modules/a",
					requires: ["b"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				b: registryEntry({
					name: "@86d-app/b",
					description: "B",
					version: "0.0.1",
					category: "general",
					path: "modules/b",
					requires: ["a"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
			},
		};
		expect(() => getModuleDependencies("a", circularManifest)).toThrow(
			"Circular dependency detected: a → b → a",
		);
	});

	it("throws on three-node cycle", () => {
		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				a: registryEntry({
					name: "@86d-app/a",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/a",
					requires: ["b"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				b: registryEntry({
					name: "@86d-app/b",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/b",
					requires: ["c"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				c: registryEntry({
					name: "@86d-app/c",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/c",
					requires: ["a"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
			},
		};
		expect(() => getModuleDependencies("a", manifest)).toThrow(
			"Circular dependency detected: a → b → c → a",
		);
	});
});

describe("detectCircularDependencies", () => {
	it("returns empty array for acyclic graph", () => {
		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				a: registryEntry({
					name: "@86d-app/a",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/a",
					requires: ["b"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				b: registryEntry({
					name: "@86d-app/b",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/b",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
			},
		};
		expect(detectCircularDependencies(manifest)).toEqual([]);
	});

	it("detects cycles across all modules", () => {
		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				a: registryEntry({
					name: "@86d-app/a",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/a",
					requires: ["b"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				b: registryEntry({
					name: "@86d-app/b",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/b",
					requires: ["a"],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
				c: registryEntry({
					name: "@86d-app/c",
					description: "",
					version: "0.0.1",
					category: "general",
					path: "modules/c",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
				}),
			},
		};
		const cycles = detectCircularDependencies(manifest);
		expect(cycles.length).toBeGreaterThan(0);
		expect(cycles[0]).toContain("→");
	});
});
