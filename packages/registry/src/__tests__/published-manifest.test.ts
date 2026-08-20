import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registryManifestPath } from "../paths.js";
import { registryManifestSchema } from "../types.js";

const manifestPath = registryManifestPath(
	resolve(import.meta.dirname, "../../../.."),
);

describe("published registry manifest", () => {
	const raw = existsSync(manifestPath)
		? JSON.parse(readFileSync(manifestPath, "utf-8"))
		: undefined;

	it("matches the manifest contract", () => {
		expect(raw).toBeDefined();
		expect(() => registryManifestSchema.parse(raw)).not.toThrow();
	});

	it("records reproducible source for every entry", () => {
		const manifest = registryManifestSchema.parse(raw);
		const entries = Object.entries(manifest.modules);
		expect(entries.length).toBeGreaterThanOrEqual(100);

		// Without both a subtree hash and a resolved commit, a fetch has nothing
		// to verify against and no fixed source to verify.
		const unreproducible = entries
			.filter(([, entry]) => !entry.subtreeIntegrity || !entry.commit)
			.map(([name]) => name);
		expect(unreproducible).toEqual([]);
	});

	it("publishes no maturity above Experimental without recorded evidence", () => {
		const manifest = registryManifestSchema.parse(raw);
		const unsupported = Object.entries(manifest.modules)
			.filter(
				([, entry]) =>
					(entry.maturity === "stable" || entry.maturity === "beta") &&
					entry.maturityEvidence.length === 0,
			)
			.map(([name]) => name);

		expect(unsupported).toEqual([]);
	});

	it("records runtime compatibility for every entry", () => {
		const manifest = registryManifestSchema.parse(raw);
		const missing = Object.entries(manifest.modules)
			.filter(([, entry]) => !entry.runtime)
			.map(([name]) => name);

		expect(missing).toEqual([]);
	});
});
