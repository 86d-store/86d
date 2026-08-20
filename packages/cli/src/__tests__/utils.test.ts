import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson } from "../utils.js";

describe("readJson", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	it("reads and parses valid JSON", () => {
		const file = join(tempDir, "test.json");
		writeFileSync(file, JSON.stringify({ name: "test", version: "1.0.0" }));

		const result = readJson<{ name: string; version: string }>(file);
		expect(result).toEqual({ name: "test", version: "1.0.0" });
	});

	it("returns undefined for missing file", () => {
		const result = readJson(join(tempDir, "nonexistent.json"));
		expect(result).toBeUndefined();
	});

	it("returns undefined for invalid JSON", () => {
		const file = join(tempDir, "bad.json");
		writeFileSync(file, "not valid json {{{");

		const result = readJson(file);
		expect(result).toBeUndefined();
	});

	it("handles nested objects", () => {
		const data = {
			dependencies: { "@86d-app/core": "workspace:*" },
			scripts: { build: "tsc" },
		};
		const file = join(tempDir, "pkg.json");
		writeFileSync(file, JSON.stringify(data));

		const result = readJson<typeof data>(file);
		expect(result?.dependencies["@86d-app/core"]).toBe("workspace:*");
	});

	it("handles empty object", () => {
		const file = join(tempDir, "empty.json");
		writeFileSync(file, "{}");

		const result = readJson(file);
		expect(result).toEqual({});
	});
});
