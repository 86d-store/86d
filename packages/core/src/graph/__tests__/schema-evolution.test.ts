import { describe, expect, it } from "vitest";
import { consumeDurableEvent, defineDurableEvent } from "../../durable-events";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { tryCompileExecutionGraph } from "../index";

function module(id: string, overrides: Partial<Module> = {}): Module {
	return { id, version: "1.0.0", storage: { kind: "none" }, ...overrides };
}

const adjustedV1 = defineDurableEvent({
	name: "inventory.adjusted",
	version: 1,
	owner: "inventory",
	payload: z.object({ productId: z.string(), delta: z.number() }).strict(),
});

const adjustedV2 = defineDurableEvent({
	name: "inventory.adjusted",
	version: 2,
	owner: "inventory",
	payload: z
		.object({
			productId: z.string(),
			delta: z.number(),
			reason: z.string().optional(),
		})
		.strict(),
});

describe("durable event schema evolution", () => {
	it("allows consumers to accept old and new exact versions before producer cutover", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory", {
					durableEvents: {
						emits: [adjustedV1, adjustedV2],
					},
				}),
				module("audit-log", {
					durableEvents: {
						handles: [
							consumeDurableEvent({
								consumer: "audit-log.inventory-adjusted.v1",
								owner: "audit-log",
								definition: adjustedV1,
								handle: async () => undefined,
							}),
							consumeDurableEvent({
								consumer: "audit-log.inventory-adjusted.v2",
								owner: "audit-log",
								definition: adjustedV2,
								handle: async () => undefined,
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.graph.edgeManifest.durableEvents).toEqual([
			{
				owner: "inventory",
				name: "inventory.adjusted",
				schemaVersion: 1,
				consumers: ["audit-log.inventory-adjusted.v1"],
			},
			{
				owner: "inventory",
				name: "inventory.adjusted",
				schemaVersion: 2,
				consumers: ["audit-log.inventory-adjusted.v2"],
			},
		]);
	});

	it("rejects implicit conversion by requiring exact integer versions", () => {
		const result = tryCompileExecutionGraph({
			modules: [
				module("inventory", {
					durableEvents: { emits: [adjustedV2] },
				}),
				module("audit-log", {
					durableEvents: {
						handles: [
							consumeDurableEvent({
								consumer: "audit-log.inventory-adjusted.v1",
								owner: "audit-log",
								definition: adjustedV1,
								handle: async () => undefined,
							}),
						],
					},
				}),
			],
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(
			result.diagnostics.some((d) => d.code === "EVENT_CONSUMER_GAP"),
		).toBe(true);
	});
});
