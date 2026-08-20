import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("status", () => {
	let tempDir: string;
	let logs: string[];

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-status-test-${Date.now()}`);
		mkdirSync(join(tempDir, "apps/store"), { recursive: true });
		mkdirSync(join(tempDir, "templates/brisa"), { recursive: true });
		mkdirSync(join(tempDir, "modules/products/src"), { recursive: true });
		mkdirSync(join(tempDir, "modules/cart/src"), { recursive: true });
		mkdirSync(join(tempDir, "node_modules"), { recursive: true });

		// tsconfig that points to brisa template
		writeFileSync(
			join(tempDir, "apps/store/tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					paths: { "template/*": ["../../templates/brisa/*"] },
				},
			}),
		);

		// Template config with 2 modules enabled
		writeFileSync(
			join(tempDir, "templates/brisa/config.json"),
			JSON.stringify({
				theme: "brisa",
				name: "Test Theme",
				modules: ["@86d-app/products"],
			}),
		);

		// .env file
		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=postgres://localhost\nSTORE_ID=store1\nBETTER_AUTH_SECRET=secret123\n",
		);

		// bun.lock
		writeFileSync(join(tempDir, "bun.lock"), "");

		logs = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	async function runStatus() {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		const { status } = await import("../commands/status.js");
		status();
	}

	it("detects active template", async () => {
		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("brisa");
		expect(output).toContain("Test Theme");
	});

	it("counts enabled and available modules", async () => {
		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("1 enabled");
		expect(output).toContain("1 available");
	});

	it("reports env vars status", async () => {
		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("all required vars set");
	});

	it("reports missing env vars", async () => {
		writeFileSync(join(tempDir, ".env"), "DATABASE_URL=postgres://localhost\n");

		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("missing");
		expect(output).toContain("STORE_ID");
	});

	it("reports deps installed", async () => {
		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("installed");
	});

	it("lists disabled modules", async () => {
		await runStatus();
		const output = logs.join("\n");
		expect(output).toContain("cart");
	});
});
