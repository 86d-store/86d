import { describe, expect, it } from "vitest";
import {
	acceptCapability,
	defineCapability,
	provideCapability,
} from "../../capabilities";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import {
	compileExecutionGraph,
	defineHook,
	implementHook,
	projection,
	runCompiledHook,
	tryCompileExecutionGraph,
} from "../index";

function module(id: string, overrides: Partial<Module> = {}): Module {
	return { id, version: "1.0.0", storage: { kind: "none" }, ...overrides };
}

const availabilityV1 = defineCapability({
	name: "inventory.availability",
	version: "1.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string() }).strict(),
	decision: z.object({ available: z.boolean() }).strict(),
	failure: z.object({ code: z.literal("not_found") }).strict(),
});

const availabilityV15 = defineCapability({
	name: "inventory.availability",
	version: "1.5.0",
	owner: "inventory",
	request: z.object({ sku: z.string() }).strict(),
	decision: z.object({ available: z.boolean(), qty: z.number() }).strict(),
	failure: z.object({ code: z.literal("not_found") }).strict(),
});

describe("capability compile and dispatch digests", () => {
	it("emits byte-identical digests across two clean builds", () => {
		const modules = [
			module("inventory", {
				capabilities: {
					provides: [
						provideCapability(availabilityV1, async () => ({
							ok: true,
							decision: { available: true },
						})),
						provideCapability(availabilityV15, async () => ({
							ok: true,
							decision: { available: true, qty: 3 },
						})),
					],
				},
			}),
			module("checkout", {
				capabilities: {
					accepts: [acceptCapability(availabilityV1, { versions: ["^1.0.0"] })],
				},
			}),
		];

		const first = compileExecutionGraph({ modules });
		const second = compileExecutionGraph({ modules });
		expect(first.graphDigest).toBe(second.graphDigest);
		expect(first.registryDigest).toBe(second.registryDigest);
		expect(first.edgeManifest).toEqual(second.edgeManifest);

		const binding = first.capabilityDispatch.get(
			`checkout\u0000inventory.availability`,
		);
		expect(binding).toMatchObject({
			available: true,
			version: "1.5.0",
			providerModuleId: "inventory",
		});
	});

	it("contains no request-time registry scan surface on the digest", () => {
		const graph = compileExecutionGraph({
			modules: [
				module("inventory", {
					capabilities: {
						provides: [
							provideCapability(availabilityV1, async () => ({
								ok: true,
								decision: { available: true },
							})),
						],
					},
				}),
				module("checkout", {
					capabilities: {
						accepts: [acceptCapability(availabilityV1)],
					},
				}),
			],
		});
		expect(graph.capabilityDispatch.size).toBe(1);
		expect(graph.edgeManifest.capabilities).toHaveLength(1);
	});
});

describe("hook order: edges, priority, and tie-breaks", () => {
	const priceHook = defineHook({
		name: "appointments.price",
		version: "1.0.0",
		owner: "appointments",
		input: z.object({ serviceId: z.string(), minutes: z.number() }).strict(),
		patch: z
			.object({
				amountMinor: z.number().optional(),
				discountMinor: z.number().optional(),
			})
			.strict(),
	});

	it("orders by graph edges then priority, moduleId, implementationId", async () => {
		const modules = [
			module("appointments", {
				hooks: {
					defines: [priceHook],
					implements: [
						implementHook(priceHook, {
							implementationId: "base",
							priority: 10,
							handle: () => ({ amountMinor: 100 }),
						}),
					],
				},
			}),
			module("loyalty", {
				hooks: {
					implements: [
						implementHook(priceHook, {
							implementationId: "discount",
							priority: 0,
							after: ["appointments/base"],
							handle: () => ({ discountMinor: 10 }),
						}),
					],
				},
			}),
			module("promo", {
				hooks: {
					implements: [
						implementHook(priceHook, {
							implementationId: "boost",
							priority: 0,
							handle: () => ({ amountMinor: 90 }),
						}),
					],
				},
			}),
		];

		const first = compileExecutionGraph({ modules });
		const second = compileExecutionGraph({ modules });
		expect(first.graphDigest).toBe(second.graphDigest);

		const chain = first.hookChains.get(
			`appointments\u0000appointments.price\u00001.0.0`,
		);
		// Explicit edge: appointments/base before loyalty/discount.
		// Eligible without unmet deps: appointments/base and promo/boost.
		// Equal priority 0: promo before appointments by moduleId? appointments priority 10,
		// promo priority 0 → promo first among eligible, then base, then discount.
		expect(chain?.order).toEqual([
			"promo/boost",
			"appointments/base",
			"loyalty/discount",
		]);

		const result = await runCompiledHook(first, priceHook, {
			serviceId: "svc",
			minutes: 30,
		});
		expect(result).toEqual({
			ok: true,
			patch: { amountMinor: 100, discountMinor: 10 },
		});
	});

	it("rejects out-of-bounds patches", async () => {
		const graph = compileExecutionGraph({
			modules: [
				module("appointments", {
					hooks: {
						defines: [priceHook],
						implements: [
							implementHook(priceHook, {
								implementationId: "mutate",
								handle: () =>
									({ amountMinor: 1, extra: true }) as {
										amountMinor: number;
									},
							}),
						],
					},
				}),
			],
		});

		const result = await runCompiledHook(graph, priceHook, {
			serviceId: "svc",
			minutes: 30,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.code).toBe("INVALID_HOOK_PATCH");
	});

	it("passes a frozen input that rejects mutation", async () => {
		const graph = compileExecutionGraph({
			modules: [
				module("appointments", {
					hooks: {
						defines: [priceHook],
						implements: [
							implementHook(priceHook, {
								implementationId: "mutate",
								handle: (input) => {
									expect(() => {
										(input as { minutes: number }).minutes = 99;
									}).toThrow();
									return { amountMinor: 1 };
								},
							}),
						],
					},
				}),
			],
		});

		const result = await runCompiledHook(graph, priceHook, {
			serviceId: "svc",
			minutes: 30,
		});
		expect(result).toEqual({ ok: true, patch: { amountMinor: 1 } });
	});

	it("applies shallow later-wins merge", async () => {
		const graph = compileExecutionGraph({
			modules: [
				module("appointments", {
					hooks: {
						defines: [priceHook],
						implements: [
							implementHook(priceHook, {
								implementationId: "a",
								priority: 0,
								handle: () => ({ amountMinor: 100, discountMinor: 5 }),
							}),
							implementHook(priceHook, {
								implementationId: "b",
								priority: 1,
								handle: () => ({ amountMinor: 80 }),
							}),
						],
					},
				}),
			],
		});
		const result = await runCompiledHook(graph, priceHook, {
			serviceId: "svc",
			minutes: 30,
		});
		expect(result).toEqual({
			ok: true,
			patch: { amountMinor: 80, discountMinor: 5 },
		});
	});
});

describe("readers from publishes", () => {
	it("compiles column-projected reader bindings and optional absence", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("appointments", {
					storage: {
						kind: "relational",
						tables: {
							appointment: {
								shape: z.object({ id: z.string(), notes: z.string() }),
							},
						},
						publishes: {
							appointment: {
								version: "1.2.0",
								table: "appointment",
								columns: ["id"],
							},
						},
					},
				}),
				module("checkout", {
					readers: {
						accepts: [
							{
								owner: "appointments",
								name: "appointment",
								versions: ["^1.0.0"],
							},
							{
								owner: "loyalty",
								name: "points",
								versions: ["^1.0.0"],
								optional: true,
							},
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.graph.edgeManifest.readers.checkout).toEqual([
			{
				available: true,
				owner: "appointments",
				name: "appointment",
				version: "1.2.0",
				table: "appointment",
				columns: ["id"],
			},
			{
				available: false,
				reason: "OWNER_NOT_INSTALLED",
				owner: "loyalty",
				name: "points",
			},
		]);
	});
});

describe("template multi-version highest match", () => {
	it("selects the highest compatible projection version", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("appointments", {
					templates: {
						data: {
							upcoming: [
								projection({
									name: "upcoming",
									version: "1.0.0",
									shape: z.array(z.object({ id: z.string() })),
									resolve: () => [],
								}),
								projection({
									name: "upcoming",
									version: "1.4.0",
									shape: z.array(z.object({ id: z.string() })),
									resolve: () => [{ id: "x" }],
								}),
							],
						},
					},
				}),
			],
			templates: [
				{
					templateId: "brisa@1.0.0",
					data: [{ projection: "appointments.upcoming", versions: ["^1.0.0"] }],
				},
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(
			result.graph.edgeManifest.templateProjections["brisa@1.0.0"],
		).toEqual([
			{
				available: true,
				owner: "appointments",
				name: "upcoming",
				version: "1.4.0",
			},
		]);
	});
});
