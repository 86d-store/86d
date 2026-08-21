import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyPackageAssets } from "../copy-package-assets.js";

describe("copyPackageAssets", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-copy-assets-${Date.now()}`);
		mkdirSync(join(tempDir, "src", "admin"), { recursive: true });
		mkdirSync(join(tempDir, "dist"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	it("copies mdx and json into dist and skips tests", () => {
		writeFileSync(join(tempDir, "src", "admin", "panel.mdx"), "# hi\n");
		writeFileSync(join(tempDir, "src", "data.json"), "{}\n");
		mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
		writeFileSync(join(tempDir, "src", "__tests__", "fixture.json"), "{}\n");
		writeFileSync(join(tempDir, "src", "index.ts"), "export {};\n");

		const result = copyPackageAssets(tempDir);
		expect(result.skipped).toBe(false);
		expect(result.copied).toBe(2);
		expect(existsSync(join(tempDir, "dist", "admin", "panel.mdx"))).toBe(true);
		expect(existsSync(join(tempDir, "dist", "data.json"))).toBe(true);
		expect(existsSync(join(tempDir, "dist", "__tests__", "fixture.json"))).toBe(
			false,
		);
	});

	it("skips when src is missing", () => {
		rmSync(join(tempDir, "src"), { recursive: true });
		const result = copyPackageAssets(tempDir);
		expect(result.skipped).toBe(true);
		expect(result.copied).toBe(0);
	});
});
