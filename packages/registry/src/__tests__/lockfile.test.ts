import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	generateLockfile,
	isLockfileSatisfied,
	readLockfile,
	verifyLockfile,
	writeLockfile,
} from "../lockfile.js";
import { registryLockfilePath } from "../paths.js";
import type { ResolvedModule } from "../types.js";

const TMP_ROOT = join(import.meta.dirname, ".tmp-lockfile-test");

beforeAll(() => {
	mkdirSync(join(TMP_ROOT, "modules", "products"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "modules", "products", "package.json"),
		JSON.stringify({ name: "@86d-app/products", version: "0.0.4" }),
	);

	mkdirSync(join(TMP_ROOT, "modules", "cart"), { recursive: true });
	writeFileSync(
		join(TMP_ROOT, "modules", "cart", "package.json"),
		JSON.stringify({ name: "@86d-app/cart", version: "0.0.2" }),
	);
});

afterAll(() => {
	rmSync(TMP_ROOT, { recursive: true, force: true });
});

const makeResolved = (
	name: string,
	source: "local" | "registry" | "github" | "npm" = "local",
): ResolvedModule => ({
	specifier: {
		raw: `@86d-app/${name}`,
		source,
		name,
		packageName: `@86d-app/${name}`,
	},
	status: "found",
	localPath: join(TMP_ROOT, "modules", name),
});

describe("generateLockfile", () => {
	it("generates lockfile from resolved modules", () => {
		const resolved: ResolvedModule[] = [
			makeResolved("products"),
			makeResolved("cart"),
		];

		const lockfile = generateLockfile(resolved, TMP_ROOT);

		expect(lockfile.lockfileVersion).toBe(1);
		expect(lockfile.generatedAt).toBeTruthy();
		expect(Object.keys(lockfile.modules)).toEqual(["cart", "products"]);
		expect(lockfile.modules.products.packageName).toBe("@86d-app/products");
		expect(lockfile.modules.products.version).toBe("0.0.4");
		expect(lockfile.modules.products.integrity).toMatch(/^sha256-/);
		expect(lockfile.modules.products.localPath).toBe("modules/products");
	});

	it("skips modules that are not found", () => {
		const resolved: ResolvedModule[] = [
			makeResolved("products"),
			{
				specifier: {
					raw: "@86d-app/missing",
					source: "registry",
					name: "missing",
					packageName: "@86d-app/missing",
				},
				status: "missing",
			},
		];

		const lockfile = generateLockfile(resolved, TMP_ROOT);
		expect(Object.keys(lockfile.modules)).toEqual(["products"]);
	});

	it("preserves GitHub specifier fields", () => {
		const resolved: ResolvedModule[] = [
			{
				specifier: {
					raw: "github:owner/repo/modules/custom",
					source: "github",
					name: "products",
					packageName: "@86d-app/products",
					repo: "owner/repo",
					ref: "v1.0.0",
					path: "modules/custom",
				},
				status: "found",
				localPath: join(TMP_ROOT, "modules", "products"),
			},
		];

		const lockfile = generateLockfile(resolved, TMP_ROOT);
		expect(lockfile.modules.products.repo).toBe("owner/repo");
		expect(lockfile.modules.products.ref).toBe("v1.0.0");
		expect(lockfile.modules.products.path).toBe("modules/custom");
	});

	it("sorts modules alphabetically", () => {
		const resolved: ResolvedModule[] = [
			makeResolved("cart"),
			makeResolved("products"),
		];

		const lockfile = generateLockfile(resolved, TMP_ROOT);
		expect(Object.keys(lockfile.modules)).toEqual(["cart", "products"]);
	});
});

describe("readLockfile / writeLockfile", () => {
	it("round-trips a lockfile", () => {
		const lockfile = generateLockfile([makeResolved("products")], TMP_ROOT);

		writeLockfile(TMP_ROOT, lockfile);
		const read = readLockfile(TMP_ROOT);

		expect(read).toBeDefined();
		expect(read?.lockfileVersion).toBe(1);
		expect(read?.modules.products.packageName).toBe("@86d-app/products");
	});

	it("returns undefined for non-existent lockfile", () => {
		expect(readLockfile("/non/existent/path")).toBeUndefined();
	});

	it("returns undefined for invalid lockfile", () => {
		const badRoot = join(TMP_ROOT, "bad-lock");
		mkdirSync(dirname(registryLockfilePath(badRoot)), { recursive: true });
		writeFileSync(registryLockfilePath(badRoot), "not json{{{");
		expect(readLockfile(badRoot)).toBeUndefined();
	});
});

describe("verifyLockfile", () => {
	it("returns empty diff when lockfile matches", () => {
		const resolved: ResolvedModule[] = [
			makeResolved("products"),
			makeResolved("cart"),
		];
		const lockfile = generateLockfile(resolved, TMP_ROOT);
		const diff = verifyLockfile(lockfile, resolved);

		expect(isLockfileSatisfied(diff)).toBe(true);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.changed).toEqual([]);
	});

	it("detects added modules", () => {
		const lockfile = generateLockfile([makeResolved("products")], TMP_ROOT);
		const resolved: ResolvedModule[] = [
			makeResolved("products"),
			makeResolved("cart"),
		];

		const diff = verifyLockfile(lockfile, resolved);
		expect(diff.added).toEqual(["cart"]);
		expect(isLockfileSatisfied(diff)).toBe(false);
	});

	it("detects removed modules", () => {
		const lockfile = generateLockfile(
			[makeResolved("products"), makeResolved("cart")],
			TMP_ROOT,
		);
		const resolved: ResolvedModule[] = [makeResolved("products")];

		const diff = verifyLockfile(lockfile, resolved);
		expect(diff.removed).toEqual(["cart"]);
		expect(isLockfileSatisfied(diff)).toBe(false);
	});

	it("detects changed integrity", () => {
		const resolved: ResolvedModule[] = [makeResolved("products")];
		const lockfile = generateLockfile(resolved, TMP_ROOT);

		// Modify the package.json to change integrity
		writeFileSync(
			join(TMP_ROOT, "modules", "products", "package.json"),
			JSON.stringify({
				name: "@86d-app/products",
				version: "0.0.5",
				modified: true,
			}),
		);

		const diff = verifyLockfile(lockfile, resolved);
		expect(diff.changed).toEqual(["products"]);
		expect(isLockfileSatisfied(diff)).toBe(false);

		// Restore original
		writeFileSync(
			join(TMP_ROOT, "modules", "products", "package.json"),
			JSON.stringify({
				name: "@86d-app/products",
				version: "0.0.4",
			}),
		);
	});
});
