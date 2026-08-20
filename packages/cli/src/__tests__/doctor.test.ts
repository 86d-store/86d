import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("doctor", () => {
	let tempDir: string;
	let logs: string[];

	beforeEach(() => {
		vi.resetModules();

		tempDir = join(tmpdir(), `86d-cli-doctor-test-${Date.now()}`);

		// Full healthy project scaffold
		mkdirSync(join(tempDir, "apps/store"), { recursive: true });
		mkdirSync(join(tempDir, "templates/brisa"), { recursive: true });
		mkdirSync(join(tempDir, "modules/products/src"), { recursive: true });
		mkdirSync(join(tempDir, "modules/cart/src"), { recursive: true });
		mkdirSync(join(tempDir, "node_modules"), { recursive: true });
		mkdirSync(join(tempDir, "internals/generators/src"), { recursive: true });

		// turbo.json (project root detection)
		writeFileSync(join(tempDir, "turbo.json"), "{}");

		// tsconfig pointing to brisa template
		writeFileSync(
			join(tempDir, "apps/store/tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					paths: { "template/*": ["../../templates/brisa/*"] },
				},
			}),
		);

		// tsconfig.base.json
		writeFileSync(join(tempDir, "tsconfig.base.json"), "{}");

		// Template config
		writeFileSync(
			join(tempDir, "templates/brisa/config.json"),
			JSON.stringify({
				theme: "brisa",
				name: "Test Theme",
				modules: ["@86d-app/products", "@86d-app/cart"],
			}),
		);

		// Module package.json files
		writeFileSync(
			join(tempDir, "modules/products/package.json"),
			JSON.stringify({ name: "@86d-app/products" }),
		);
		writeFileSync(
			join(tempDir, "modules/products/src/index.ts"),
			"export default function products() {}",
		);
		writeFileSync(
			join(tempDir, "modules/cart/package.json"),
			JSON.stringify({ name: "@86d-app/cart" }),
		);
		writeFileSync(
			join(tempDir, "modules/cart/src/index.ts"),
			"export default function cart() {}",
		);

		// .env with all required vars
		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=postgres://localhost\nSTORE_ID=store1\nBETTER_AUTH_SECRET=secret123\nRESEND_API_KEY=re_123\nNEXT_PUBLIC_STORE_URL=http://localhost:3000\nNEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID=GTM-123\n",
		);

		// Lockfile
		writeFileSync(join(tempDir, "bun.lock"), "");

		// Generation scripts
		writeFileSync(
			join(tempDir, "internals/generators/src/generate-modules.ts"),
			"",
		);
		writeFileSync(
			join(tempDir, "internals/generators/src/generate-component-docs.ts"),
			"",
		);

		logs = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	async function runDoctor(nodeVersion = "25.0.0") {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		// Mock execSync for bun version check
		vi.doMock("node:child_process", () => ({
			execSync: (cmd: string) => {
				if (cmd === "bun --version") return "1.3.6\n";
				throw new Error(`Unexpected command: ${cmd}`);
			},
		}));

		// Mock net.createConnection for database connectivity check
		vi.doMock("node:net", () => ({
			createConnection: () => {
				const ee = new (require("node:events").EventEmitter)();
				setTimeout(() => ee.emit("connect"), 1);
				return Object.assign(ee, { destroy: () => {} });
			},
		}));

		const { doctor } = await import("../commands/doctor.js");
		await doctor({ nodeVersion });
	}

	it("reports healthy project with no issues", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("No issues found");
	});

	it.each(["23.0.0", "24.12.0", "25.9.3"])(
		"accepts supported Node.js version %s",
		async (nodeVersion) => {
			await runDoctor(nodeVersion);

			const output = logs.join("\n");
			expect(output).toContain("Node.js");
			expect(output).toContain(`v${nodeVersion}`);
			expect(output).toContain("No issues found");
		},
	);

	it.each(["22.22.0", "26.0.0"])(
		"rejects unsupported Node.js version %s",
		async (nodeVersion) => {
			await runDoctor(nodeVersion);

			const output = logs.join("\n");
			expect(output).toContain(`v${nodeVersion} (requires 23, 24, or 25)`);
			expect(output).toContain("Upgrade Node.js to version 23, 24, or 25");
			expect(output).not.toContain("No issues found");
		},
	);

	it("checks Bun installation", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("Bun");
		expect(output).toContain("1.3.6");
	});

	it("detects active template", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("brisa");
		expect(output).toContain("Test Theme");
	});

	it("reports all modules valid", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("2 modules");
		expect(output).toContain("all valid");
	});

	it("reports all required env vars set", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("all required vars set");
	});

	it("warns about missing .env file", async () => {
		rmSync(join(tempDir, ".env"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("no .env file");
		expect(output).toContain("86d init");
	});

	it("reports missing required env vars", async () => {
		writeFileSync(join(tempDir, ".env"), "DATABASE_URL=postgres://localhost\n");
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("STORE_ID");
		expect(output).toContain("BETTER_AUTH_SECRET");
	});

	it("warns about missing optional env vars", async () => {
		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=postgres://localhost\nSTORE_ID=store1\nBETTER_AUTH_SECRET=secret\n",
		);
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("RESEND_API_KEY");
		expect(output).toContain("email sending");
	});

	it("detects missing dependencies", async () => {
		rmSync(join(tempDir, "node_modules"), { recursive: true });
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("not installed");
		expect(output).toContain("bun install");
	});

	it("warns about missing lockfile", async () => {
		rmSync(join(tempDir, "bun.lock"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("no lockfile");
	});

	it("detects module with missing package.json", async () => {
		rmSync(join(tempDir, "modules/cart/package.json"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("cart: missing package.json");
	});

	it("detects module with missing index.ts", async () => {
		rmSync(join(tempDir, "modules/cart/src/index.ts"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("cart: missing src/index.ts");
	});

	it("detects enabled module that does not exist", async () => {
		writeFileSync(
			join(tempDir, "templates/brisa/config.json"),
			JSON.stringify({
				theme: "brisa",
				modules: ["@86d-app/products", "@86d-app/cart", "@86d-app/nonexistent"],
			}),
		);
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("@86d-app/nonexistent");
		expect(output).toContain("not found");
	});

	it("warns about missing generation scripts", async () => {
		rmSync(join(tempDir, "internals/generators/src/generate-modules.ts"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("generate-modules.ts");
	});

	it("checks TypeScript configs exist", async () => {
		await runDoctor();

		const output = logs.join("\n");
		expect(output).toContain("TypeScript");
		expect(output).toContain("configs present");
	});

	it("reports error count and warning count", async () => {
		rmSync(join(tempDir, ".env"));
		rmSync(join(tempDir, "internals/generators/src/generate-modules.ts"));
		vi.resetModules();

		await runDoctor();

		const output = logs.join("\n");
		// Should have at least 1 error (missing .env) and warnings
		expect(output).toContain("error");
	});
});
