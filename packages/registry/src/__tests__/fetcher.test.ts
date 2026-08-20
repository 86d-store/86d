import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { computeIntegrity, ensureCacheDir, fetchModule } from "../fetcher.js";
import type { ModuleSpecifier, RegistryManifest } from "../types.js";

const TMP_ROOT = join(import.meta.dirname, ".tmp-fetcher-test");

beforeAll(() => {
	// Create a fake project structure with a local module
	mkdirSync(join(TMP_ROOT, "modules", "products", "src"), {
		recursive: true,
	});
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "package.json"),
		JSON.stringify({ name: "@86d-app/products", version: "0.0.1" }),
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("fetchModule", () => {
	it("returns local path for local source", async () => {
		const spec: ModuleSpecifier = {
			raw: "products",
			source: "local",
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "modules", "products"));
	});

	it("fails for registry source without manifest", async () => {
		const spec: ModuleSpecifier = {
			raw: "@86d-app/shipping",
			source: "registry",
			name: "shipping",
			packageName: "@86d-app/shipping",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(false);
		expect(result.error).toContain("No registry manifest");
	});

	it("fails for registry source with module not in manifest", async () => {
		const spec: ModuleSpecifier = {
			raw: "@86d-app/unknown",
			source: "registry",
			name: "unknown",
			packageName: "@86d-app/unknown",
		};

		const manifest: RegistryManifest = {
			version: 1,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			modules: {},
			templates: {},
		};

		const result = await fetchModule(spec, TMP_ROOT, manifest);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found in registry");
	});

	it("fails for github source without repo", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:",
			source: "github",
			name: "test",
			packageName: "@86d-app/test",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(false);
		expect(result.error).toContain("missing repo");
	});

	it("skips fetch for github source when module already exists", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:86d-app/86d/modules/products",
			source: "github",
			name: "products",
			packageName: "@86d-app/products",
			repo: "86d-app/86d",
			path: "modules/products",
			ref: "main",
		};

		const result = await fetchModule(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "modules", "products"));
	});
});

describe("ensureCacheDir", () => {
	it("creates .86d directory", () => {
		const cacheDir = ensureCacheDir(TMP_ROOT);
		expect(cacheDir).toBe(join(TMP_ROOT, ".86d"));
	});
});

describe("computeIntegrity", () => {
	it("computes sha256 hash over the Module subtree", () => {
		const hash = computeIntegrity(join(TMP_ROOT, "modules", "products"));
		expect(hash).toBeDefined();
		expect(hash).toMatch(/^sha256-[a-f0-9]{64}$/);
	});

	it("returns undefined for a missing module directory", () => {
		const hash = computeIntegrity("/non/existent/module");
		expect(hash).toBeUndefined();
	});
});

describe("registry fetch verification", () => {
	// A failed verification deletes the unverified source, so each case
	// restores the fixture rather than inheriting the previous one.
	beforeEach(() => {
		mkdirSync(join(TMP_ROOT, "modules", "products", "src"), {
			recursive: true,
		});
		writeFileSync(
			join(TMP_ROOT, "modules", "products", "package.json"),
			JSON.stringify({ name: "@86d-app/products", version: "0.0.1" }),
		);
	});

	function manifestWith(entry: Record<string, unknown>) {
		return {
			version: 1 as const,
			baseUrl: "https://github.com/86d-app/86d",
			defaultRef: "main",
			templates: {},
			modules: {
				products: {
					name: "@86d-app/products",
					description: "",
					version: "1.0.0",
					category: "general",
					path: "modules/products",
					requires: [],
					hasStoreComponents: false,
					hasAdminComponents: false,
					hasStorePages: false,
					maturity: "experimental" as const,
					maturityEvidence: [],
					providesCapabilities: [],
					acceptsCapabilities: [],
					emitsDurableEvents: [],
					handlesDurableEvents: [],
					...entry,
				},
			},
		};
	}

	it("refuses a registry entry that records no subtree hash", async () => {
		// The Module is already present locally, so the fetch short-circuits to
		// the existing directory and goes straight to verification.
		const spec = {
			raw: "products",
			source: "registry" as const,
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(spec, TMP_ROOT, manifestWith({}));

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/unverified source/i);
	});

	it("refuses a registry entry whose subtree hash does not match", async () => {
		const spec = {
			raw: "products",
			source: "registry" as const,
			name: "products",
			packageName: "@86d-app/products",
		};

		const result = await fetchModule(
			spec,
			TMP_ROOT,
			manifestWith({ subtreeIntegrity: `sha256-${"0".repeat(64)}` }),
		);

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/Integrity check failed/);
	});
});
