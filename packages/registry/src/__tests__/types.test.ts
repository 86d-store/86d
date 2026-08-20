import { describe, expect, it } from "vitest";
import { registryManifestSchema, registryModuleSchema } from "../types.js";

describe("registryModuleSchema", () => {
	it("validates a valid module entry", () => {
		const result = registryModuleSchema.safeParse({
			name: "@86d-app/products",
			description: "Product catalog",
			version: "0.0.1",
			category: "catalog",
			path: "modules/products",
			requires: ["customers"],
			hasStoreComponents: true,
			hasAdminComponents: true,
			hasStorePages: true,
		});
		expect(result.success).toBe(true);
	});

	it("applies defaults for optional fields", () => {
		const result = registryModuleSchema.parse({
			name: "@86d-app/products",
			description: "Product catalog",
			version: "0.0.1",
			category: "catalog",
			path: "modules/products",
		});
		expect(result.requires).toEqual([]);
		expect(result.hasStoreComponents).toBe(false);
		expect(result.hasAdminComponents).toBe(false);
		expect(result.hasStorePages).toBe(false);
	});

	it("rejects missing required fields", () => {
		const result = registryModuleSchema.safeParse({
			name: "@86d-app/products",
		});
		expect(result.success).toBe(false);
	});
});

describe("registryManifestSchema", () => {
	it("validates a full manifest", () => {
		const result = registryManifestSchema.safeParse({
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			modules: {
				products: {
					name: "@86d-app/products",
					description: "Product catalog",
					version: "0.0.1",
					category: "catalog",
					path: "modules/products",
				},
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects wrong version", () => {
		const result = registryManifestSchema.safeParse({
			version: 2,
			baseUrl: "https://github.com/86d-app/86d",
			modules: {},
		});
		expect(result.success).toBe(false);
	});

	it("applies default ref", () => {
		const result = registryManifestSchema.parse({
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			modules: {},
		});
		expect(result.defaultRef).toBe("main");
	});
});
