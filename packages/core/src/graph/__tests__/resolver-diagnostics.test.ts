import { describe, expect, it } from "vitest";
import {
	acceptCapability,
	defineCapability,
	provideCapability,
} from "../../capabilities";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { defineHook, implementHook } from "../hooks";
import {
	diagnosticFingerprint,
	matchesCaret,
	matchesContractRanges,
	parseContractRange,
	resolveHighestMatchingVersion,
	tryCompileExecutionGraph,
	validateContractRanges,
} from "../index";
import { projection } from "../projections";

function module(id: string, overrides: Partial<Module> = {}): Module {
	return { id, version: "1.0.0", storage: { kind: "none" }, ...overrides };
}

describe("ContractRange grammar", () => {
	it.each([
		["1.2.3", { kind: "exact", version: "1.2.3" }],
		["^1.2.3", { kind: "caret", base: "1.2.3" }],
		["^0.2.3", { kind: "caret", base: "0.2.3" }],
		["^0.0.3", { kind: "caret", base: "0.0.3" }],
	] as const)("parses %s", (input, expected) => {
		expect(parseContractRange(input)).toEqual(expected);
	});

	it.each(["*", "1.x", ">=1.0.0", "1.0.0-alpha", "^1", "1.2", ""])(
		"rejects invalid grammar %s",
		(input) => {
			expect(parseContractRange(input)).toBeUndefined();
		},
	);

	it("rejects empty, duplicate, and invalid range lists", () => {
		expect(validateContractRanges([])).toEqual({ ok: false, reason: "empty" });
		expect(validateContractRanges(["1.0.0", "1.0.0"])).toEqual({
			ok: false,
			reason: "duplicate",
		});
		expect(validateContractRanges(["1.x"])).toMatchObject({
			ok: false,
			reason: "invalid_grammar",
		});
	});
});

describe("caret boundaries including 0.x", () => {
	it.each([
		["1.2.3", "1.2.3", true],
		["1.9.9", "1.2.3", true],
		["2.0.0", "1.2.3", false],
		["1.2.2", "1.2.3", false],
		["0.2.3", "0.2.3", true],
		["0.2.9", "0.2.3", true],
		["0.3.0", "0.2.3", false],
		["0.2.2", "0.2.3", false],
		["0.0.3", "0.0.3", true],
		["0.0.4", "0.0.3", false],
		["0.0.2", "0.0.3", false],
	] as const)("matchesCaret(%s, %s) → %s", (candidate, base, expected) => {
		expect(matchesCaret(candidate, base)).toBe(expected);
	});

	it("treats range arrays as a union", () => {
		expect(matchesContractRanges("1.5.0", ["^1.0.0", "2.0.0"])).toBe(true);
		expect(matchesContractRanges("2.0.0", ["^1.0.0", "2.0.0"])).toBe(true);
		expect(matchesContractRanges("3.0.0", ["^1.0.0", "2.0.0"])).toBe(false);
	});
});

describe("highest-match resolution", () => {
	const definitions = [
		{
			kind: "capability" as const,
			owner: "inventory",
			name: "availability",
			version: "1.0.0",
		},
		{
			kind: "capability" as const,
			owner: "inventory",
			name: "availability",
			version: "1.2.0",
		},
		{
			kind: "capability" as const,
			owner: "inventory",
			name: "availability",
			version: "2.0.0",
		},
	];

	it("selects the highest matching SemVer", () => {
		expect(
			resolveHighestMatchingVersion({
				kind: "capability",
				owner: "inventory",
				name: "availability",
				ranges: ["^1.0.0"],
				definitions,
			}),
		).toEqual({ ok: true, version: "1.2.0" });
	});

	it("rejects duplicate identity at the same version", () => {
		expect(
			resolveHighestMatchingVersion({
				kind: "capability",
				owner: "inventory",
				name: "availability",
				ranges: ["1.0.0"],
				definitions: [
					{
						kind: "capability",
						owner: "inventory",
						name: "availability",
						version: "1.0.0",
					},
					{
						kind: "capability",
						owner: "inventory",
						name: "availability",
						version: "1.0.0",
					},
				],
			}),
		).toMatchObject({ ok: false, reason: "duplicate_identity" });
	});
});

const availabilityV1 = defineCapability({
	name: "inventory.availability",
	version: "1.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string() }).strict(),
	decision: z.object({ available: z.boolean() }).strict(),
	failure: z.object({ code: z.literal("not_found") }).strict(),
});

const availabilityV2 = defineCapability({
	name: "inventory.availability",
	version: "1.5.0",
	owner: "inventory",
	request: z.object({ sku: z.string() }).strict(),
	decision: z.object({ available: z.boolean(), qty: z.number() }).strict(),
	failure: z.object({ code: z.literal("not_found") }).strict(),
});

describe("optional and required owners", () => {
	it("compiles optional absent owner to OWNER_NOT_INSTALLED", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("checkout", {
					capabilities: {
						accepts: [
							acceptCapability(availabilityV1, {
								versions: ["^1.0.0"],
								optional: true,
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const binding = result.graph.capabilityDispatch.get(
			`checkout\u0000inventory.availability`,
		);
		expect(binding).toEqual({
			available: false,
			reason: "OWNER_NOT_INSTALLED",
			consumerId: "checkout",
			name: "inventory.availability",
			owner: "inventory",
		});
	});

	it("fails when required owner is absent", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("checkout", {
					capabilities: {
						accepts: [
							acceptCapability(availabilityV1, { versions: ["^1.0.0"] }),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("REQUIRED_OWNER_ABSENT");
	});

	it("fails when optional owner is installed but missing the contract", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory"),
				module("checkout", {
					capabilities: {
						accepts: [
							acceptCapability(availabilityV1, {
								versions: ["^1.0.0"],
								optional: true,
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe(
			"INSTALLED_OWNER_MISSING_CONTRACT",
		);
	});

	it("fails installed-but-incompatible optional contracts", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV2, async () => ({
								ok: true,
								decision: { available: true, qty: 1 },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: {
						accepts: [
							acceptCapability(availabilityV1, {
								versions: ["1.0.0"],
								optional: true,
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("INCOMPATIBLE_VERSION");
	});
});

describe("duplicate identities and invalid grammar", () => {
	it("rejects duplicate capability identities", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: false },
							})),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(
			result.diagnostics.some((d) => d.code === "DUPLICATE_IDENTITY"),
		).toBe(true);
	});

	it("rejects invalid range grammar on acceptance", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("checkout", {
					capabilities: {
						accepts: [
							{
								definition: availabilityV1,
								name: availabilityV1.name,
								owner: availabilityV1.owner,
								versions: ["1.x"],
								optional: false,
							},
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("INVALID_RANGE_GRAMMAR");
	});
});

describe("hooks: cycles and absent order references", () => {
	const priceHook = defineHook({
		name: "appointments.price",
		version: "1.0.0",
		owner: "appointments",
		input: z.object({ serviceId: z.string() }).strict(),
		patch: z.object({ amountMinor: z.number().optional() }).strict(),
	});

	it("names Module and edge on absent before/after references", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("appointments", {
					hooks: {
						defines: [priceHook],
						implements: [
							implementHook(priceHook, {
								implementationId: "base",
								before: ["loyalty/discount"],
								handle: () => ({ amountMinor: 100 }),
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("HOOK_ORDER_REFERENCE_ABSENT");
		expect(result.diagnostics[0]?.moduleId).toBe("appointments");
		expect(result.diagnostics[0]?.edge).toBe("appointments.price");
		expect(diagnosticFingerprint(result.diagnostics)).toContain(
			"HOOK_ORDER_REFERENCE_ABSENT",
		);
	});

	it("rejects hook cycles", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("appointments", {
					hooks: {
						defines: [priceHook],
						implements: [
							implementHook(priceHook, {
								implementationId: "a",
								before: ["appointments/b"],
								handle: () => ({}),
							}),
							implementHook(priceHook, {
								implementationId: "b",
								before: ["appointments/a"],
								handle: () => ({}),
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("HOOK_CYCLE");
	});
});

describe("readers and template data", () => {
	it("fails missing required readers", () => {
		const missing = tryCompileExecutionGraph({
			modules: [
				module("checkout", {
					readers: {
						accepts: [
							{
								owner: "appointments",
								name: "appointment",
								versions: ["^1.0.0"],
							},
						],
					},
				}),
			],
		});
		expect(missing.ok).toBe(false);
		if (missing.ok) return;
		expect(missing.diagnostics[0]?.code).toBe("MISSING_READER");
	});

	it("binds optional template absence and a valid projection", () => {
		const upcoming = projection({
			name: "upcoming",
			version: "1.4.0",
			shape: z.array(z.object({ id: z.string() })),
			resolve: () => [{ id: "x" }],
		});
		const result = tryCompileExecutionGraph({
			modules: [module("appointments", { templates: { data: { upcoming } } })],
			templates: [
				{
					templateId: "brisa@1.0.0",
					data: [
						{ projection: "appointments.upcoming", versions: ["^1.0.0"] },
						{
							projection: "loyalty.balance",
							versions: ["^1.0.0"],
							optional: true,
						},
					],
				},
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const bindings =
			result.graph.edgeManifest.templateProjections["brisa@1.0.0"];
		expect(bindings).toEqual([
			{
				available: true,
				owner: "appointments",
				name: "upcoming",
				version: "1.4.0",
			},
			{
				available: false,
				reason: "OWNER_NOT_INSTALLED",
				owner: "loyalty",
				name: "balance",
			},
		]);
	});

	it("fails installed-but-incompatible template owners", () => {
		const upcoming = projection({
			name: "upcoming",
			version: "2.0.0",
			shape: z.array(z.object({ id: z.string() })),
			resolve: () => [],
		});
		const result = tryCompileExecutionGraph({
			modules: [module("appointments", { templates: { data: { upcoming } } })],
			templates: [
				{
					templateId: "brisa@1.0.0",
					data: [{ projection: "appointments.upcoming", versions: ["^1.0.0"] }],
				},
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("INCOMPATIBLE_VERSION");
	});
});

describe("exact durable event versions", () => {
	it("rejects non-positive event schema versions", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory", {
					durableEvents: {
						emits: [
							{
								name: "inventory.adjusted",
								version: 0 as number,
								owner: "inventory",
								payload: z.object({}).strict(),
							},
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.diagnostics[0]?.code).toBe("INVALID_EVENT_VERSION");
	});
});
