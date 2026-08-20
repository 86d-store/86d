import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_MATURITY,
	MATURITY_FILE,
	type MaturityRecord,
	resolveModuleMaturity,
} from "../maturity.js";

let root: string;

function writeModule(record?: MaturityRecord | string): string {
	const modulePath = join(root, "demo");
	mkdirSync(join(modulePath, "src"), { recursive: true });
	writeFileSync(join(modulePath, "package.json"), "{}");
	// A complete-looking Module: source, endpoints, admin pages.
	writeFileSync(join(modulePath, "src/index.ts"), "export default () => ({});");
	writeFileSync(join(modulePath, "src/controllers.ts"), "export const c = {};");
	if (record !== undefined) {
		writeFileSync(
			join(modulePath, MATURITY_FILE),
			typeof record === "string" ? record : JSON.stringify(record),
		);
	}
	return modulePath;
}

const evidence = [
	{
		kind: "production-smoke",
		reference: "launch-evidence/2026-08-12/demo",
		recordedAt: "2026-08-12",
	},
];

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "registry-maturity-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("resolveModuleMaturity", () => {
	it("does not infer maturity from a complete-looking Module", () => {
		// Source volume, a clean tree, and a full endpoint surface establish
		// nothing. Without a record the Module needs advanced opt-in.
		const modulePath = writeModule();

		expect(resolveModuleMaturity(modulePath)).toEqual({
			maturity: DEFAULT_MATURITY,
			evidence: [],
		});
		expect(DEFAULT_MATURITY).toBe("experimental");
	});

	it("publishes a claim its evidence supports", () => {
		const modulePath = writeModule({ maturity: "stable", evidence });

		expect(resolveModuleMaturity(modulePath)).toEqual({
			maturity: "stable",
			evidence,
		});
	});

	it("downgrades a Stable claim with no evidence", () => {
		const modulePath = writeModule({ maturity: "stable", evidence: [] });

		const resolved = resolveModuleMaturity(modulePath);

		expect(resolved.maturity).toBe("experimental");
		expect(resolved.downgradedFrom).toBe("stable");
		expect(resolved.downgradeReason).toMatch(/requires at least 1/);
	});

	it("downgrades a Beta claim with no evidence", () => {
		const modulePath = writeModule({ maturity: "beta", evidence: [] });

		expect(resolveModuleMaturity(modulePath).maturity).toBe("experimental");
	});

	it("accepts Experimental and Deprecated without evidence", () => {
		expect(
			resolveModuleMaturity(
				writeModule({ maturity: "experimental", evidence: [] }),
			).maturity,
		).toBe("experimental");
		rmSync(join(root, "demo"), { recursive: true, force: true });
		expect(
			resolveModuleMaturity(
				writeModule({ maturity: "deprecated", evidence: [] }),
			).maturity,
		).toBe("deprecated");
	});

	it("falls back rather than trusting an unreadable record", () => {
		const modulePath = writeModule("{ not json");

		const resolved = resolveModuleMaturity(modulePath);

		expect(resolved.maturity).toBe(DEFAULT_MATURITY);
		expect(resolved.downgradeReason).toMatch(/unreadable/i);
	});

	it("rejects a level outside the contract", () => {
		const modulePath = writeModule(
			JSON.stringify({ maturity: "production-ready", evidence }),
		);

		expect(resolveModuleMaturity(modulePath).maturity).toBe(DEFAULT_MATURITY);
	});
});
