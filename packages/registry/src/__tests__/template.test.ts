import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	fetchTemplate,
	getLocalTemplateNames,
	readTemplateConfig,
	resolveTemplate,
} from "../template.js";
import type { ModuleSpecifier, RegistryManifest } from "../types.js";

const TMP_ROOT = join(import.meta.dirname, ".tmp-template-test");

beforeAll(() => {
	// Create a fake template structure
	mkdirSync(join(TMP_ROOT, "templates", "brisa"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "templates", "brisa", "config.json"),
		JSON.stringify({
			theme: "brisa",
			name: "Brisa Starter Kit",
			modules: "*",
		}),
	);

	mkdirSync(join(TMP_ROOT, "templates", "minimal"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "templates", "minimal", "config.json"),
		JSON.stringify({
			theme: "minimal",
			name: "Minimal Theme",
			modules: ["@86d-app/products"],
		}),
	);

	// Template directory without config.json (should be skipped)
	mkdirSync(join(TMP_ROOT, "templates", "incomplete"), { recursive: true });

	// npm template in node_modules
	mkdirSync(join(TMP_ROOT, "node_modules", "@acme", "store-theme"), {
		recursive: true,
	});
	writeFileSync(
		join(TMP_ROOT, "node_modules", "@acme", "store-theme", "package.json"),
		JSON.stringify({ name: "@acme/store-theme" }),
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

const testManifest: RegistryManifest = {
	version: 1,
	baseUrl: "https://github.com/86d-app/86d",
	defaultRef: "main",
	modules: {},
	templates: {
		brisa: {
			name: "brisa",
			description: "Brisa Starter Kit",
			version: "0.0.1",
			path: "templates/brisa",
		},
		premium: {
			name: "premium",
			description: "Premium Theme",
			version: "1.0.0",
			path: "templates/premium",
		},
	},
};

describe("resolveTemplate", () => {
	it("resolves a local template by name", () => {
		const result = resolveTemplate("brisa", TMP_ROOT, testManifest);
		expect(result.status).toBe("found");
		expect(result.specifier.source).toBe("local");
		expect(result.localPath).toBe(join(TMP_ROOT, "templates", "brisa"));
	});

	it("resolves a template not local but in registry as missing", () => {
		const result = resolveTemplate("premium", TMP_ROOT, testManifest);
		expect(result.status).toBe("missing");
		expect(result.specifier.source).toBe("registry");
	});

	it("returns error for unknown template", () => {
		const result = resolveTemplate("unknown", TMP_ROOT, testManifest);
		expect(result.status).toBe("missing");
		expect(result.error).toContain("not found");
	});

	it("resolves a GitHub template specifier", () => {
		const result = resolveTemplate(
			"github:owner/repo/templates/custom",
			TMP_ROOT,
			testManifest,
		);
		expect(result.status).toBe("missing");
		expect(result.specifier.source).toBe("github");
		expect(result.specifier.repo).toBe("owner/repo");
	});

	it("resolves npm template specifier as missing when not installed", () => {
		const result = resolveTemplate(
			"npm:@acme/unknown-theme",
			TMP_ROOT,
			testManifest,
		);
		expect(result.status).toBe("missing");
		expect(result.specifier.source).toBe("npm");
	});

	it("resolves npm template as found when installed in node_modules", () => {
		const result = resolveTemplate(
			"npm:@acme/store-theme",
			TMP_ROOT,
			testManifest,
		);
		expect(result.status).toBe("found");
		expect(result.specifier.source).toBe("npm");
		expect(result.localPath).toBe(
			join(TMP_ROOT, "node_modules", "@acme", "store-theme"),
		);
	});

	it("resolves without manifest (local only)", () => {
		const result = resolveTemplate("brisa", TMP_ROOT);
		expect(result.status).toBe("found");
		expect(result.specifier.source).toBe("local");
	});

	it("returns missing for non-local template without manifest", () => {
		const result = resolveTemplate("nonexistent", TMP_ROOT);
		expect(result.status).toBe("missing");
		expect(result.error).toContain("not found");
	});

	it("resolves local GitHub template if already downloaded", () => {
		// brisa exists locally and has config.json
		const result = resolveTemplate(
			"github:86d-app/86d/templates/brisa",
			TMP_ROOT,
			testManifest,
		);
		expect(result.status).toBe("found");
		expect(result.specifier.source).toBe("local");
	});
});

describe("fetchTemplate", () => {
	it("returns local path for local source", async () => {
		const spec: ModuleSpecifier = {
			raw: "brisa",
			source: "local",
			name: "brisa",
			packageName: "@86d-app/brisa",
		};
		const result = await fetchTemplate(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "templates", "brisa"));
	});

	it("fails for registry source without template in manifest", async () => {
		const spec: ModuleSpecifier = {
			raw: "unknown",
			source: "registry",
			name: "unknown",
			packageName: "@86d-app/unknown",
		};
		const result = await fetchTemplate(spec, TMP_ROOT, testManifest);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found in registry");
	});

	it("fails for registry source with invalid baseUrl", async () => {
		const spec: ModuleSpecifier = {
			raw: "premium",
			source: "registry",
			name: "premium",
			packageName: "@86d-app/premium",
		};
		const badManifest: RegistryManifest = {
			...testManifest,
			baseUrl: "https://not-github.com/nope",
		};
		const result = await fetchTemplate(spec, TMP_ROOT, badManifest);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Invalid registry baseUrl");
	});

	it("skips fetch when template already exists locally", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:86d-app/86d/templates/brisa",
			source: "github",
			name: "brisa",
			packageName: "@86d-app/brisa",
			repo: "86d-app/86d",
			path: "templates/brisa",
			ref: "main",
		};
		const result = await fetchTemplate(spec, TMP_ROOT);
		expect(result.success).toBe(true);
		expect(result.localPath).toBe(join(TMP_ROOT, "templates", "brisa"));
	});

	it("fails for github source without repo", async () => {
		const spec: ModuleSpecifier = {
			raw: "github:",
			source: "github",
			name: "test",
			packageName: "@86d-app/test",
		};
		const result = await fetchTemplate(spec, TMP_ROOT);
		expect(result.success).toBe(false);
		expect(result.error).toContain("missing repo");
	});
});

describe("getLocalTemplateNames", () => {
	it("returns sorted template names with config.json", () => {
		const names = getLocalTemplateNames(TMP_ROOT);
		// "incomplete" is excluded because it has no config.json
		expect(names).toEqual(["brisa", "minimal"]);
	});

	it("returns empty array for non-existent path", () => {
		expect(getLocalTemplateNames("/non/existent")).toEqual([]);
	});
});

describe("readTemplateConfig", () => {
	it("reads and parses config.json", () => {
		const config = readTemplateConfig(join(TMP_ROOT, "templates", "brisa"));
		expect(config).toBeDefined();
		expect(config?.theme).toBe("brisa");
		expect(config?.name).toBe("Brisa Starter Kit");
	});

	it("returns undefined for missing config", () => {
		const config = readTemplateConfig(
			join(TMP_ROOT, "templates", "incomplete"),
		);
		expect(config).toBeUndefined();
	});

	it("returns undefined for non-existent path", () => {
		const config = readTemplateConfig("/non/existent/template");
		expect(config).toBeUndefined();
	});

	it("returns undefined for invalid JSON", () => {
		const badDir = join(TMP_ROOT, "templates", "bad-json");
		mkdirSync(badDir, { recursive: true });
		writeFileSync(join(badDir, "config.json"), "not valid json{{{");
		const config = readTemplateConfig(badDir);
		expect(config).toBeUndefined();
	});
});
