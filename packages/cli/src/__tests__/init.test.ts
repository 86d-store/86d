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

describe("init", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-init-test-${Date.now()}`);
		mkdirSync(join(tempDir, "apps/store"), { recursive: true });
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "node_modules/.bin"), { recursive: true });

		// Model a clean checkout: the environment template lives at repository root.
		writeFileSync(
			join(tempDir, ".env.example"),
			"DATABASE_URL=\nSTORE_ID=\nBETTER_AUTH_SECRET=change-me-to-a-random-string\n",
		);

		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	/** Build a net mock. If `reachable=true`, fires "connect"; otherwise fires "error". */
	function makeNetMock(reachable = false) {
		return {
			createConnection: vi.fn(() => {
				const handlers: Record<string, () => void> = {};
				const emitter = {
					on: vi.fn((evt: string, cb: () => void) => {
						handlers[evt] = cb;
						return emitter;
					}),
					destroy: vi.fn(),
				};
				setTimeout(
					() => (reachable ? handlers.connect?.() : handlers.error?.()),
					0,
				);
				return emitter;
			}),
		};
	}

	async function runInit(args: string[] = [], netReachable = false) {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		// Mock execSync to avoid running bun install / tsx in tests
		vi.doMock("node:child_process", () => ({
			execSync: vi.fn(),
		}));

		// Mock net.createConnection so DB reachability check doesn't hang
		vi.doMock("node:net", () => makeNetMock(netReachable));

		const { init } = await import("../commands/init.js");
		await init(args);
	}

	it("creates .env from the root .env.example in a clean checkout", async () => {
		await runInit();

		expect(existsSync(join(tempDir, ".env"))).toBe(true);
	});

	it("generates a random BETTER_AUTH_SECRET", async () => {
		await runInit();

		const envContent = readFileSync(join(tempDir, ".env"), "utf-8");
		expect(envContent).not.toContain("change-me-to-a-random-string");
		// Should have a base64url secret (at least 20 chars)
		const match = envContent.match(/BETTER_AUTH_SECRET=(.+)/);
		expect(match?.[1]?.length).toBeGreaterThanOrEqual(20);
	});

	it("skips .env copy if .env already exists", async () => {
		writeFileSync(join(tempDir, ".env"), "EXISTING=value\n");

		await runInit();

		const envContent = readFileSync(join(tempDir, ".env"), "utf-8");
		expect(envContent).toBe("EXISTING=value\n");
	});

	it("preserves other env vars when replacing secret", async () => {
		await runInit();

		const envContent = readFileSync(join(tempDir, ".env"), "utf-8");
		expect(envContent).toContain("DATABASE_URL=");
		expect(envContent).toContain("STORE_ID=");
	});

	it("accepts --yes flag without prompting", async () => {
		// .env with no DATABASE_URL — skips DB section cleanly
		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=\nSTORE_ID=test\nBETTER_AUTH_SECRET=already-set\n",
		);
		// Does not throw — no readline.question calls expected
		await runInit(["--yes"]);
	});

	it("accepts -y short flag without prompting", async () => {
		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=\nSTORE_ID=test\nBETTER_AUTH_SECRET=already-set\n",
		);
		await runInit(["-y"]);
	});

	it("skips DB setup when DATABASE_URL is not set", async () => {
		// .env has empty DATABASE_URL (default from .env.example)
		await runInit();

		// Should complete without errors
		expect(existsSync(join(tempDir, ".env"))).toBe(true);
	});

	it("runs migrate and seed when --yes and db is reachable", async () => {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		const execSyncMock = vi.fn();
		vi.doMock("node:child_process", () => ({ execSync: execSyncMock }));

		// Simulate reachable DB — fire "connect" callback
		vi.doMock("node:net", () => ({
			createConnection: vi.fn(() => {
				const handlers: Record<string, () => void> = {};
				const emitter = {
					on: vi.fn((evt: string, cb: () => void) => {
						handlers[evt] = cb;
						return emitter;
					}),
					destroy: vi.fn(),
				};
				setTimeout(() => handlers.connect?.(), 0);
				return emitter;
			}),
		}));

		// Seed script exists
		mkdirSync(join(tempDir, "packages/db/src"), { recursive: true });
		writeFileSync(join(tempDir, "packages/db/src/seed.ts"), "// seed");
		// packages/db with migration directory
		mkdirSync(join(tempDir, "packages/db/prisma/migrations"), {
			recursive: true,
		});

		writeFileSync(
			join(tempDir, ".env"),
			"DATABASE_URL=postgresql://user:pass@localhost:5432/db\nSTORE_ID=test\nBETTER_AUTH_SECRET=already-set\n",
		);

		const { init } = await import("../commands/init.js");
		await init(["--yes"]);

		// Should have called bun install + migrate + seed
		const calls = execSyncMock.mock.calls.map((c: unknown[]) => String(c[0]));
		expect(calls.some((c) => c.includes("bun install"))).toBe(true);
		expect(calls.some((c) => c.includes("migrate deploy"))).toBe(true);
		expect(calls.some((c) => c.includes("--filter db seed"))).toBe(true);

		// Seed call should pass APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD env vars
		const seedCall = execSyncMock.mock.calls.find(
			(c: unknown[]) =>
				typeof c[0] === "string" && c[0].includes("--filter db seed"),
		);
		const seedEnv = (seedCall?.[1] as { env?: Record<string, string> })?.env;
		expect(seedEnv?.APP_ADMIN_EMAIL).toBe("admin@example.com");
		expect(seedEnv?.APP_ADMIN_PASSWORD).toBe("password123");
	});
});
