import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildManifest } from "../manifest.js";

const TMP_ROOT = join(import.meta.dirname, ".tmp-manifest-test");

beforeAll(() => {
	// Create a fake template structure
	mkdirSync(join(TMP_ROOT, "templates", "brisa"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "templates", "brisa", "config.json"),
		JSON.stringify({
			theme: "brisa",
			name: "Brisa Starter Kit",
			version: "1.0.0",
		}),
	);

	// Create a fake module structure
	mkdirSync(
		join(TMP_ROOT, "modules", "products", "src", "store", "components"),
		{
			recursive: true,
		},
	);
	mkdirSync(
		join(TMP_ROOT, "modules", "products", "src", "admin", "components"),
		{
			recursive: true,
		},
	);
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "package.json"),
		JSON.stringify({
			name: "@86d-app/products",
			version: "0.0.4",
			description: "Product catalog management",
		}),
	);
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "src", "index.ts"),
		`export default function products() {
	return {
		id: "products",
		version: "0.0.4",
		admin: {
			pages: [
				{ path: "/admin/products", component: "ProductList", group: "Catalog" },
			],
		},
		store: {
			pages: [
				{ path: "/products", component: "ProductListing" },
			],
		},
	};
}`,
	);
	writeFileSync(
		join(
			TMP_ROOT,
			"modules",
			"products",
			"src",
			"store",
			"components",
			"mdx.tsx",
		),
		"export default {};",
	);
	writeFileSync(
		join(
			TMP_ROOT,
			"modules",
			"products",
			"src",
			"admin",
			"components",
			"index.tsx",
		),
		"export {};",
	);

	// Another module without components
	mkdirSync(join(TMP_ROOT, "modules", "analytics", "src"), {
		recursive: true,
	});
	writeFileSync(
		join(TMP_ROOT, "modules", "analytics", "package.json"),
		JSON.stringify({
			name: "@86d-app/analytics",
			version: "0.0.1",
			description: "Analytics tracking",
		}),
	);
	writeFileSync(
		join(TMP_ROOT, "modules", "analytics", "src", "index.ts"),
		`export default function analytics() {
	return { id: "analytics", version: "0.0.1" };
}`,
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("buildManifest", () => {
	it("builds manifest from local modules", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(manifest.version).toBe(1);
		expect(manifest.baseUrl).toBe("https://github.com/86d-app/86d");
		expect(manifest.defaultRef).toBe("main");
	});

	it("includes all modules", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(Object.keys(manifest.modules).sort()).toEqual([
			"analytics",
			"products",
		]);
	});

	it("extracts module metadata", () => {
		const manifest = buildManifest(TMP_ROOT);
		const products = manifest.modules.products;

		expect(products.name).toBe("@86d-app/products");
		expect(products.version).toBe("0.0.4");
		expect(products.description).toBe("Product catalog management");
		expect(products.path).toBe("modules/products");
	});

	it("takes declared metadata from the Module, not from its source text", () => {
		// A pattern match over `index.ts` cannot see a category or a page list
		// that is assembled in a helper, and records nothing without saying so.
		// The generator loads each Module and passes what it declares.
		const manifest = buildManifest(TMP_ROOT, {
			declarations: {
				products: {
					id: "products",
					category: "catalog",
					hasStorePages: true,
					requires: ["inventory"],
					providesCapabilities: [
						{
							name: "catalog.product.read",
							owner: "products",
							versions: ["1.0.0"],
						},
					],
					acceptsCapabilities: [
						{
							name: "inventory.stock.check",
							owner: "inventory",
							versions: ["1.0.0"],
						},
					],
					emitsDurableEvents: [
						{ name: "products.published", owner: "products", version: 1 },
					],
				},
			},
		});
		const products = manifest.modules.products;

		expect(products.category).toBe("catalog");
		expect(products.hasStorePages).toBe(true);
		expect(products.requires).toEqual(["inventory"]);
		expect(products.providesCapabilities).toEqual([
			{ name: "catalog.product.read", owner: "products", versions: ["1.0.0"] },
		]);
		expect(products.acceptsCapabilities).toEqual([
			{
				name: "inventory.stock.check",
				owner: "inventory",
				versions: ["1.0.0"],
			},
		]);
		expect(products.emitsDurableEvents).toEqual([
			{ name: "products.published", owner: "products", version: 1 },
		]);
	});

	it("records nothing rather than guessing when a Module declares nothing", () => {
		const manifest = buildManifest(TMP_ROOT);

		expect(manifest.modules.products.category).toBe("general");
		expect(manifest.modules.products.hasStorePages).toBe(false);
		expect(manifest.modules.products.providesCapabilities).toEqual([]);
	});

	it("detects store components", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(manifest.modules.products.hasStoreComponents).toBe(true);
		expect(manifest.modules.analytics.hasStoreComponents).toBe(false);
	});

	it("detects admin components", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(manifest.modules.products.hasAdminComponents).toBe(true);
		expect(manifest.modules.analytics.hasAdminComponents).toBe(false);
	});

	it("reports store pages from the declaration", () => {
		const manifest = buildManifest(TMP_ROOT, {
			declarations: {
				products: { id: "products", hasStorePages: true },
				analytics: { id: "analytics", hasStorePages: false },
			},
		});
		expect(manifest.modules.products.hasStorePages).toBe(true);
		expect(manifest.modules.analytics.hasStorePages).toBe(false);
	});

	it("uses custom baseUrl and ref", () => {
		const manifest = buildManifest(TMP_ROOT, {
			baseUrl: "https://github.com/custom/repo",
			defaultRef: "develop",
		});
		expect(manifest.baseUrl).toBe("https://github.com/custom/repo");
		expect(manifest.defaultRef).toBe("develop");
	});

	it("handles non-existent modules directory", () => {
		const manifest = buildManifest("/non/existent/path");
		expect(Object.keys(manifest.modules)).toHaveLength(0);
	});

	it("includes templates in manifest", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(Object.keys(manifest.templates)).toEqual(["brisa"]);
		expect(manifest.templates.brisa.name).toBe("brisa");
		expect(manifest.templates.brisa.description).toBe("Brisa Starter Kit");
		expect(manifest.templates.brisa.version).toBe("1.0.0");
		expect(manifest.templates.brisa.path).toBe("templates/brisa");
	});

	it("computes integrity hashes for modules", () => {
		const manifest = buildManifest(TMP_ROOT);
		expect(manifest.modules.products.integrity).toBeDefined();
		expect(manifest.modules.products.integrity).toMatch(
			/^sha256-[a-f0-9]{64}$/,
		);
	});
});
