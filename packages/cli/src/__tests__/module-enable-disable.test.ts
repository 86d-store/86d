import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("module enable/disable", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-enable-test-${Date.now()}`);
		mkdirSync(join(tempDir, "apps/store"), { recursive: true });
		mkdirSync(join(tempDir, "templates/brisa"), { recursive: true });
		mkdirSync(join(tempDir, "modules/products/src"), { recursive: true });
		mkdirSync(join(tempDir, "modules/cart/src"), { recursive: true });
		mkdirSync(join(tempDir, "modules/wishlist/src"), { recursive: true });

		// tsconfig pointing to brisa
		writeFileSync(
			join(tempDir, "apps/store/tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					paths: { "template/*": ["../../templates/brisa/*"] },
				},
			}),
		);

		// Template config with only products enabled
		writeFileSync(
			join(tempDir, "templates/brisa/config.json"),
			JSON.stringify(
				{
					theme: "brisa",
					name: "Test Theme",
					modules: ["@86d-app/products"],
				},
				null,
				"\t",
			),
		);
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	async function runModuleCommand(subcommand: string, args: string[]) {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		const { moduleCommand } = await import("../commands/module.js");
		moduleCommand(subcommand, args);
	}

	function readConfig(): { modules?: string[] } {
		return JSON.parse(
			readFileSync(join(tempDir, "templates/brisa/config.json"), "utf-8"),
		);
	}

	it("enables a module by adding it to config.json", async () => {
		await runModuleCommand("enable", ["cart"]);

		const config = readConfig();
		expect(config.modules).toContain("@86d-app/cart");
		expect(config.modules).toContain("@86d-app/products");
	});

	it("handles @86d-app/ prefix when enabling", async () => {
		await runModuleCommand("enable", ["@86d-app/wishlist"]);

		const config = readConfig();
		expect(config.modules).toContain("@86d-app/wishlist");
	});

	it("does not duplicate already-enabled module", async () => {
		await runModuleCommand("enable", ["products"]);

		const config = readConfig();
		const count = config.modules?.filter(
			(m) => m === "@86d-app/products",
		).length;
		expect(count).toBe(1);
	});

	it("disables a module by removing it from config.json", async () => {
		await runModuleCommand("disable", ["products"]);

		const config = readConfig();
		expect(config.modules).not.toContain("@86d-app/products");
		expect(config.modules).toHaveLength(0);
	});

	it("handles @86d-app/ prefix when disabling", async () => {
		await runModuleCommand("disable", ["@86d-app/products"]);

		const config = readConfig();
		expect(config.modules).not.toContain("@86d-app/products");
	});

	it("warns when disabling a module that is not enabled", async () => {
		vi.spyOn(console, "log");
		await runModuleCommand("disable", ["cart"]);

		const config = readConfig();
		// Config should remain unchanged
		expect(config.modules).toEqual(["@86d-app/products"]);
	});
});
