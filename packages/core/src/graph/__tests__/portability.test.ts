import { describe, expect, it } from "vitest";
import {
	acceptCapability,
	defineCapability,
	provideCapability,
} from "../../capabilities";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { compileExecutionGraph } from "../index";

function module(id: string, overrides: Partial<Module> = {}): Module {
	return { id, version: "1.0.0", storage: { kind: "none" }, ...overrides };
}

const availability = defineCapability({
	name: "inventory.availability",
	version: "1.0.0",
	owner: "inventory",
	request: z.object({ sku: z.string() }).strict(),
	decision: z.object({ available: z.boolean() }).strict(),
	failure: z.object({ code: z.literal("not_found") }).strict(),
});

describe("graph portability digests", () => {
	it("emits identical digests for the same installed graph across repeated compiles", () => {
		const modules: Module[] = [
			module("inventory", {
				capabilities: {
					provides: [
						provideCapability(availability, async () => ({
							ok: true,
							decision: { available: true },
						})),
					],
				},
			}),
			module("checkout", {
				capabilities: {
					accepts: [acceptCapability(availability, { versions: ["^1.0.0"] })],
				},
			}),
		];

		const standalone = compileExecutionGraph({ modules });
		const docker = compileExecutionGraph({ modules: [...modules] });
		const managed = compileExecutionGraph({
			modules: modules.map((entry) => ({ ...entry })),
		});

		expect(standalone.graphDigest).toBe(docker.graphDigest);
		expect(docker.graphDigest).toBe(managed.graphDigest);
		expect(standalone.registryDigest).toBe(managed.registryDigest);
		expect(standalone.edgeManifest).toEqual(managed.edgeManifest);
	});

	it("fails broken graphs before any request-time discovery path exists", () => {
		expect(() =>
			compileExecutionGraph({
				modules: [
					module("checkout", {
						capabilities: {
							accepts: [acceptCapability(availability)],
						},
					}),
				],
			}),
		).toThrow(/Execution graph compile failed/);
	});
});
