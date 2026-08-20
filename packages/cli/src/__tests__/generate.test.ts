import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("generate", () => {
	let tempDir: string;
	let mockExecSync: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();

		tempDir = join(tmpdir(), `86d-cli-generate-test-${Date.now()}`);
		mkdirSync(join(tempDir, "internals/generators/src"), { recursive: true });
		mkdirSync(join(tempDir, "node_modules/.bin"), { recursive: true });

		writeFileSync(
			join(tempDir, "internals/generators/src/generate-modules.ts"),
			"",
		);
		writeFileSync(
			join(tempDir, "internals/generators/src/generate-component-docs.ts"),
			"",
		);

		// Create tsx binary stub
		writeFileSync(join(tempDir, "node_modules/.bin/tsx"), "");

		mockExecSync = vi.fn();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		vi.restoreAllMocks();
	});

	async function runGenerate(args: string[]) {
		vi.resetModules();
		vi.doMock("../utils.js", async () => {
			const actual =
				await vi.importActual<typeof import("../utils.js")>("../utils.js");
			return {
				...actual,
				findProjectRoot: () => tempDir,
			};
		});

		vi.doMock("node:child_process", () => ({
			execSync: mockExecSync,
		}));

		const { generate } = await import("../commands/generate.js");
		generate(args);
	}

	it("runs module generation script", async () => {
		await runGenerate(["modules"]);

		expect(mockExecSync).toHaveBeenCalledTimes(1);
		expect(mockExecSync.mock.calls[0][0]).toContain("generate-modules.ts");
	});

	it("runs component docs script", async () => {
		await runGenerate(["components"]);

		expect(mockExecSync).toHaveBeenCalledTimes(1);
		expect(mockExecSync.mock.calls[0][0]).toContain(
			"generate-component-docs.ts",
		);
	});

	it("runs both scripts when called with no subcommand", async () => {
		await runGenerate([]);

		expect(mockExecSync).toHaveBeenCalledTimes(2);
	});

	it("exits with error when module script is missing", async () => {
		rmSync(join(tempDir, "internals/generators/src/generate-modules.ts"));

		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});

		await expect(runGenerate(["modules"])).rejects.toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
	});

	it("skips component docs gracefully when script missing", async () => {
		rmSync(
			join(tempDir, "internals/generators/src/generate-component-docs.ts"),
		);

		// Should not throw
		await runGenerate(["components"]);
		expect(mockExecSync).not.toHaveBeenCalled();
	});
});
