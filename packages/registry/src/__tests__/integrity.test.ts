import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	computeSubtreeIntegrity,
	moduleSourceFiles,
	verifySubtreeIntegrity,
} from "../integrity.js";

let root: string;

function writeModule(files: Record<string, string>): string {
	const modulePath = join(root, "demo");
	for (const [relative, contents] of Object.entries(files)) {
		const absolute = join(modulePath, relative);
		mkdirSync(join(absolute, ".."), { recursive: true });
		writeFileSync(absolute, contents);
	}
	return modulePath;
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "registry-integrity-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("computeSubtreeIntegrity", () => {
	it("covers Module source, not just the package manifest", () => {
		const modulePath = writeModule({
			"package.json": '{"name":"@86d-app/demo","version":"1.0.0"}',
			"src/controllers.ts": "export const rate = 0.05;",
		});
		const before = computeSubtreeIntegrity(modulePath);

		// The behavior changes while package.json stays byte-identical.
		writeFileSync(
			join(modulePath, "src/controllers.ts"),
			"export const rate = 1;",
		);
		const after = computeSubtreeIntegrity(modulePath);

		expect(before).toBeDefined();
		expect(after).not.toBe(before);
	});

	it("is stable across repeated runs", () => {
		const modulePath = writeModule({
			"package.json": "{}",
			"src/index.ts": "export default 1;",
			"src/nested/deep.ts": "export const x = 2;",
		});

		expect(computeSubtreeIntegrity(modulePath)).toBe(
			computeSubtreeIntegrity(modulePath),
		);
	});

	it("changes when a file is renamed but its bytes are not", () => {
		const first = writeModule({
			"package.json": "{}",
			"src/a.ts": "export {};",
		});
		const hashA = computeSubtreeIntegrity(first);
		rmSync(join(first, "src/a.ts"));
		writeFileSync(join(first, "src/b.ts"), "export {};");

		expect(computeSubtreeIntegrity(first)).not.toBe(hashA);
	});

	it("cannot be collided by shifting bytes between files", () => {
		const one = writeModule({ "package.json": "{}", "src/a.ts": "ab" });
		const hashOne = computeSubtreeIntegrity(one);
		writeFileSync(join(one, "src/a.ts"), "a");
		writeFileSync(join(one, "src/b.ts"), "b");

		expect(computeSubtreeIntegrity(one)).not.toBe(hashOne);
	});

	it("ignores build output that the source already determines", () => {
		const modulePath = writeModule({
			"package.json": "{}",
			"src/index.ts": "export default 1;",
		});
		const clean = computeSubtreeIntegrity(modulePath);

		mkdirSync(join(modulePath, "dist"), { recursive: true });
		writeFileSync(join(modulePath, "dist/index.js"), "compiled");
		mkdirSync(join(modulePath, "node_modules/dep"), { recursive: true });
		writeFileSync(join(modulePath, "node_modules/dep/index.js"), "dep");

		expect(computeSubtreeIntegrity(modulePath)).toBe(clean);
		expect(moduleSourceFiles(modulePath).some((f) => f.includes("dist"))).toBe(
			false,
		);
	});

	it("returns nothing for a missing directory", () => {
		expect(computeSubtreeIntegrity(join(root, "absent"))).toBeUndefined();
	});
});

describe("verifySubtreeIntegrity", () => {
	it("accepts a matching subtree", () => {
		const modulePath = writeModule({ "package.json": "{}" });
		const expected = computeSubtreeIntegrity(modulePath);

		expect(verifySubtreeIntegrity(modulePath, expected)).toEqual({
			ok: true,
			integrity: expected,
		});
	});

	it("refuses when no hash was recorded", () => {
		const modulePath = writeModule({ "package.json": "{}" });

		const verdict = verifySubtreeIntegrity(modulePath, undefined);

		expect(verdict.ok).toBe(false);
		expect(verdict).toMatchObject({
			reason: expect.stringMatching(/unverified/i),
		});
	});

	it("refuses a malformed hash instead of ignoring it", () => {
		const modulePath = writeModule({ "package.json": "{}" });

		expect(verifySubtreeIntegrity(modulePath, "not-a-hash").ok).toBe(false);
	});

	it("refuses when the Module directory is absent", () => {
		expect(
			verifySubtreeIntegrity(join(root, "absent"), "sha256-deadbeef").ok,
		).toBe(false);
	});

	it("refuses a modified subtree", () => {
		const modulePath = writeModule({
			"package.json": "{}",
			"src/index.ts": "export default 1;",
		});
		const expected = computeSubtreeIntegrity(modulePath);
		writeFileSync(join(modulePath, "src/index.ts"), "export default 2;");

		const verdict = verifySubtreeIntegrity(modulePath, expected);

		expect(verdict.ok).toBe(false);
		expect(verdict).toMatchObject({
			reason: expect.stringContaining("Integrity check failed"),
		});
	});

	it("refuses an emptied Module rather than treating it as nothing to check", () => {
		const modulePath = writeModule({ "package.json": "{}", "src/a.ts": "x" });
		const expected = computeSubtreeIntegrity(modulePath);
		rmSync(join(modulePath, "src/a.ts"));
		rmSync(join(modulePath, "package.json"));

		expect(verifySubtreeIntegrity(modulePath, expected).ok).toBe(false);
	});
});
