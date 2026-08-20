import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEnvFile } from "../utils.js";

describe("parseEnvFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `86d-cli-env-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it("parses basic key=value pairs", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "FOO=bar\nBAZ=qux\n");

		const vars = parseEnvFile(file);
		expect(vars).toEqual({ FOO: "bar", BAZ: "qux" });
	});

	it("skips comments and empty lines", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "# comment\n\nFOO=bar\n  # another\nBAZ=qux");

		const vars = parseEnvFile(file);
		expect(vars).toEqual({ FOO: "bar", BAZ: "qux" });
	});

	it("strips double quotes from values", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, 'DATABASE_URL="postgres://localhost/db"\n');

		const vars = parseEnvFile(file);
		expect(vars.DATABASE_URL).toBe("postgres://localhost/db");
	});

	it("strips single quotes from values", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "SECRET='my-secret'\n");

		const vars = parseEnvFile(file);
		expect(vars.SECRET).toBe("my-secret");
	});

	it("handles values with equals signs", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "URL=postgres://host?sslmode=require\n");

		const vars = parseEnvFile(file);
		expect(vars.URL).toBe("postgres://host?sslmode=require");
	});

	it("handles empty values", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "EMPTY=\nSET=value\n");

		const vars = parseEnvFile(file);
		expect(vars.EMPTY).toBe("");
		expect(vars.SET).toBe("value");
	});

	it("returns empty object for missing file", () => {
		const vars = parseEnvFile(join(tempDir, "nonexistent"));
		expect(vars).toEqual({});
	});

	it("skips lines without equals sign", () => {
		const file = join(tempDir, ".env");
		writeFileSync(file, "invalid-line\nFOO=bar\n");

		const vars = parseEnvFile(file);
		expect(vars).toEqual({ FOO: "bar" });
	});
});
