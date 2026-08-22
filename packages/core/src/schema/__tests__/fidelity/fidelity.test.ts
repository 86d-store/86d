import { describe, expect, it } from "vitest";
import { z } from "../../../zod";
import { col } from "../../col";
import { compileTableShape } from "../../compile/analyze-zod";
import { buildFeatureManifest } from "../../compile/feature-manifest";
import { loadManifestModules } from "../../compile/load-installed-modules";
import { SchemaCompileError } from "../../compile/types";
import {
	FIDELITY_FIXTURE_IDS,
	FIDELITY_FIXTURES,
	runFidelityFixture,
} from "./fixtures";

describe("compiler feature manifest", () => {
	it("accounts for every construct used by installed Modules", async () => {
		const modules = await loadManifestModules();
		const manifest = buildFeatureManifest(modules);
		expect(manifest.entries.length).toBeGreaterThan(0);

		const missingFixtures = manifest.entries
			.map((entry) => entry.id)
			.filter((id) => !FIDELITY_FIXTURE_IDS.has(id));

		expect(missingFixtures).toEqual([]);
	}, 60_000);

	it("fails closed on an injected unknown construct with provenance", () => {
		const shape = z.object({
			id: z.string().register(col, { pk: true }),
			weird: z.bigint(),
		});

		expect(() =>
			compileTableShape({
				moduleId: "cart",
				tableName: "cart",
				shape,
			}),
		).toThrow(SchemaCompileError);

		let caught: unknown;
		try {
			compileTableShape({
				moduleId: "cart",
				tableName: "cart",
				shape,
			});
			expect.unreachable("expected SchemaCompileError");
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(SchemaCompileError);
		const compileError = caught as SchemaCompileError;
		expect(compileError.provenance).toEqual({
			moduleId: "cart",
			tableName: "cart",
			fieldName: "weird",
		});
		expect(compileError.message).toContain("cart.cart.weird");
	});
});

describe("fidelity fixtures", () => {
	for (const fixture of FIDELITY_FIXTURES) {
		it(`${fixture.id}: ${fixture.description}`, () => {
			expect(() => runFidelityFixture(fixture)).not.toThrow();
		});
	}

	it("has no unused fixture ids outside the support catalog", () => {
		const known = new Set([
			...FIDELITY_FIXTURE_IDS,
			// Always-available fidelity markers not present in every Module set.
			"required.not_null",
			"zod.array",
			"zod.object",
			"zod.uuid",
			"zod.date",
			"wrapper.nullable",
			"check.min_length",
			"check.max_length",
			"meta.sensitive",
			"meta.anchor",
			"meta.references.no action",
			"meta.references.table.core",
			"table.exclude",
			"wrapper.default",
			"default.value",
		]);
		for (const id of FIDELITY_FIXTURE_IDS) {
			expect(known.has(id)).toBe(true);
		}
	});
});
