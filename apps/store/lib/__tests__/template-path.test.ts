import { describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
}));

import { existsSync } from "node:fs";
import { resolveTemplatePath } from "../template-path";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("resolveTemplatePath", () => {
	it("returns the cwd-relative path when it exists", () => {
		(existsSync as ReturnType<typeof vi.fn>).mockImplementation(
			(p: string) =>
				p.includes("templates/brisa/config.json") && !p.includes("../.."),
		);

		const result = resolveTemplatePath();

		expect(result).toContain("templates");
		expect(result).toContain("brisa");
		expect(result).toContain("config.json");
		expect(result).not.toContain("../..");
	});

	it("returns the second candidate when cwd-relative does not exist", () => {
		let callCount = 0;
		(existsSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
			callCount++;
			// First call (cwd-relative) returns false; second call (monorepo-relative) returns true
			return callCount === 2;
		});

		const result = resolveTemplatePath();

		// The second candidate goes two levels up from cwd — its absolute path
		// will be two directories above the current working directory.
		const cwd = process.cwd();
		const expectedRoot = require("node:path").resolve(cwd, "..", "..");
		expect(result).toContain("templates");
		expect(result).toContain("brisa");
		expect(result).toContain("config.json");
		// The result points to a path above cwd
		expect(result.startsWith(expectedRoot)).toBe(true);
	});

	it("falls back to the cwd-relative path when neither candidate exists", () => {
		(existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const result = resolveTemplatePath();

		expect(result).toContain("templates/brisa/config.json");
		expect(result).not.toContain("../../");
	});

	it("returns a string path in all cases", () => {
		(existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const result = resolveTemplatePath();

		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("prefers cwd-relative over monorepo-relative when both exist", () => {
		(existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

		const result = resolveTemplatePath();

		// First candidate wins — does not contain ../../
		expect(result).not.toContain("../../");
	});
});
