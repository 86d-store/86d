import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test the module scaffolding logic by mocking findProjectRoot
 * to point at a temp directory, then running the module command.
 */

describe("module create", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-module-test-${Date.now()}`);
		mkdirSync(join(tempDir, "modules"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	async function runModuleCreate(name: string) {
		vi.resetModules();
		// Mock findProjectRoot to return our temp dir
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		const { moduleCommand } = await import("../commands/module.js");
		moduleCommand("create", [name]);
	}

	it("scaffolds the correct directory structure", async () => {
		await runModuleCreate("test-feature");

		const moduleDir = join(tempDir, "modules", "test-feature");
		expect(existsSync(moduleDir)).toBe(true);
		expect(existsSync(join(moduleDir, "src/index.ts"))).toBe(true);
		expect(existsSync(join(moduleDir, "src/schema.ts"))).toBe(true);
		expect(existsSync(join(moduleDir, "src/store/endpoints/routes.ts"))).toBe(
			true,
		);
		expect(existsSync(join(moduleDir, "src/admin/endpoints/routes.ts"))).toBe(
			true,
		);
		expect(existsSync(join(moduleDir, "src/store/components/mdx.tsx"))).toBe(
			true,
		);
		expect(existsSync(join(moduleDir, "src/admin/components"))).toBe(true);
		expect(existsSync(join(moduleDir, "src/__tests__/index.test.ts"))).toBe(
			true,
		);
		expect(existsSync(join(moduleDir, "package.json"))).toBe(true);
		expect(existsSync(join(moduleDir, "tsconfig.json"))).toBe(true);
	});

	it("generates correct package.json", async () => {
		await runModuleCreate("loyalty-points");

		const pkg = JSON.parse(
			readFileSync(
				join(tempDir, "modules", "loyalty-points", "package.json"),
				"utf-8",
			),
		);

		expect(pkg.name).toBe("@86d-app/loyalty-points");
		expect(pkg.version).toBe("0.0.1");
		expect(pkg.dependencies["@86d-app/core"]).toBe("workspace:*");
		expect(pkg.scripts.build).toBe("86d module build");
		expect(pkg.devDependencies["86d"]).toBe("workspace:*");
		expect(pkg.exports["."]).toBe("./src/index.ts");
		expect(pkg.scripts.test).toBe("vitest run");
	});

	it("generates module entry with correct ID and camelCase name", async () => {
		await runModuleCreate("loyalty-points");

		const content = readFileSync(
			join(tempDir, "modules", "loyalty-points", "src/index.ts"),
			"utf-8",
		);

		expect(content).toContain('id: "loyalty-points"');
		expect(content).toContain("function loyaltyPoints(");
		expect(content).toContain('version: "0.0.1"');
	});

	it("generates PascalCase type name in schema", async () => {
		await runModuleCreate("loyalty-points");

		const content = readFileSync(
			join(tempDir, "modules", "loyalty-points", "src/schema.ts"),
			"utf-8",
		);

		expect(content).toContain("type LoyaltyPointsData");
	});

	it("generates test file that references the module", async () => {
		await runModuleCreate("loyalty-points");

		const content = readFileSync(
			join(tempDir, "modules", "loyalty-points", "src/__tests__/index.test.ts"),
			"utf-8",
		);

		expect(content).toContain('describe("loyalty-points"');
		expect(content).toContain("import loyaltyPoints");
		expect(content).toContain('expect(mod.id).toBe("loyalty-points")');
	});

	it("strips @86d-app/ prefix from name", async () => {
		await runModuleCreate("@86d-app/custom-module");

		const moduleDir = join(tempDir, "modules", "custom-module");
		expect(existsSync(moduleDir)).toBe(true);

		const pkg = JSON.parse(
			readFileSync(join(moduleDir, "package.json"), "utf-8"),
		);
		expect(pkg.name).toBe("@86d-app/custom-module");
	});
});
