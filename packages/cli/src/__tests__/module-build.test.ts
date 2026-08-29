import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildModule } from "../commands/module-build.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

describe("buildModule", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "86d-module-build-"));
		mkdirSync(join(tempDir, "src", "admin"), { recursive: true });
		mkdirSync(join(tempDir, "dist", "store", "endpoints"), {
			recursive: true,
		});
		mkdirSync(join(tempDir, "dist", "admin"), { recursive: true });
		writeFileSync(join(tempDir, "package.json"), '{"type":"module"}\n');
		writeFileSync(join(tempDir, "tsconfig.json"), "{}\n");
		writeFileSync(join(tempDir, "src", "index.ts"), "export {};\n");
		writeFileSync(join(tempDir, "src", "admin", "panel.mdx"), "# Panel\n");
		writeFileSync(
			join(tempDir, "dist", "store", "endpoints", "withdrawn.js"),
			"export const withdrawn = true;\n",
		);
		writeFileSync(join(tempDir, "dist", "admin", "removed.mdx"), "# Removed\n");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("cleans stale output before compiling and preserves current output", () => {
		let staleOutputPresentWhenCompilerStarted = false;
		vi.mocked(spawnSync).mockImplementation((_command, _args, options) => {
			staleOutputPresentWhenCompilerStarted = existsSync(
				join(tempDir, "dist", "store", "endpoints", "withdrawn.js"),
			);
			const cwd = typeof options?.cwd === "string" ? options.cwd : tempDir;
			mkdirSync(join(cwd, "dist"), { recursive: true });
			writeFileSync(join(cwd, "dist", "index.js"), "export {};\n");
			return {
				pid: 1,
				output: [null, null, null],
				stdout: null,
				stderr: null,
				status: 0,
				signal: null,
			};
		});

		buildModule([tempDir]);

		expect(staleOutputPresentWhenCompilerStarted).toBe(false);
		expect(
			existsSync(join(tempDir, "dist", "store", "endpoints", "withdrawn.js")),
		).toBe(false);
		expect(existsSync(join(tempDir, "dist", "admin", "removed.mdx"))).toBe(
			false,
		);
		expect(readFileSync(join(tempDir, "dist", "index.js"), "utf8")).toBe(
			"export {};\n",
		);
		expect(
			readFileSync(join(tempDir, "dist", "admin", "panel.mdx"), "utf8"),
		).toBe("# Panel\n");
	});
});
