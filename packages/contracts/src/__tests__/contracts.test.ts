import { describe, expect, it } from "vitest";
import { computeChangeSetReviewHash } from "../change-set";
import {
	actionLevelSchema,
	assertCanonicalJson,
	canonicalJson,
	canTransitionCommand,
	canTransitionWorkflow,
	commandRequestSchema,
	computeCommandBindingHash,
	computeCommandInputDigest,
	computeConfirmationNonceDigest,
	parseCanonicalJson,
} from "../command";
import {
	assertConformancePin,
	CONFORMANCE_DIGEST,
	computeConformanceDigest,
	EXPECTED_PIN,
	isCompatiblePackagePair,
} from "../conformance";
import fixture from "./fixtures/command-conformance.json";

describe("@86d-app/contracts command surface", () => {
	it("accepts the shared transport-neutral request envelope", () => {
		expect(commandRequestSchema.parse(fixture.validRequest)).toEqual(
			fixture.validRequest,
		);
	});

	it("rejects actor injection and unversioned Commands", () => {
		for (const request of fixture.invalidRequests) {
			expect(commandRequestSchema.safeParse(request).success).toBe(false);
		}
	});

	it("implements the shared Command and Workflow transitions", () => {
		for (const [from, to, allowed] of fixture.commandTransitions) {
			expect(canTransitionCommand(from, to)).toBe(allowed);
		}
		for (const [from, to, allowed] of fixture.workflowTransitions) {
			expect(canTransitionWorkflow(from, to)).toBe(allowed);
		}
	});

	it("validates every action level", () => {
		for (const level of ["automatic", "approve", "confirm_now"]) {
			expect(actionLevelSchema.parse(level)).toBe(level);
		}
	});

	it("denies noncanonical serialization", () => {
		const value = { b: 1, a: 2 };
		const canonical = canonicalJson(value);
		expect(parseCanonicalJson(canonical)).toEqual({ a: 2, b: 1 });
		expect(() => assertCanonicalJson('{"b":1,"a":2}')).toThrow(
			/Noncanonical serialization/,
		);
		expect(() => assertCanonicalJson('{"a": 2, "b": 1}')).toThrow(
			/Noncanonical serialization/,
		);
	});
});

describe("@86d-app/contracts digests", () => {
	it("matches shared hash vectors", () => {
		const store = { type: "store" as const, id: "store-001" };
		expect(
			computeCommandInputDigest("command-input-vector-key-000000001", {
				plane: "store_runtime",
				command: { name: "store_runtime.inventory.adjust", version: 2 },
				target: store,
				input: { quantity: 4, sku: "SKU-001" },
			}),
		).toBe(fixture.hashVectors.commandInput);

		const owner = { type: "store" as const, id: "Z" };
		const other = { type: "store" as const, id: "a" };
		expect(
			computeChangeSetReviewHash({
				changeSetHashVersion: 1,
				ownerPlane: "store_runtime",
				target: owner,
				proposal: {
					command: { name: "store_runtime.test", version: 1 },
					target: owner,
					inputDigest: "a".repeat(64),
				},
				baseRevisions: [
					{ target: other, revision: "r2" },
					{ target: owner, revision: "r1" },
				],
				affectedTargets: [other, owner],
				beforeSummary: {},
				afterSummary: {},
				publicEffects: ["z", "A"],
				operationalEffects: ["é", "e"],
				estimatedCharges: [
					{ amount: "2", currency: "USD", description: "a" },
					{ amount: "1", currency: "USD", description: "Z" },
				],
				requiredPermissions: ["z", "A"],
				validationBlocks: ["é", "e"],
				rollbackCoverage: "database",
			}),
		).toBe(fixture.hashVectors.changeSetReview);

		expect(
			computeCommandBindingHash({
				bindingHashVersion: 1,
				plane: "store_runtime",
				command: { name: "store_runtime.tracer.confirm", version: 1 },
				target: store,
				inputDigest: "c".repeat(64),
				disclosure: "Spend USD 25.00 for a tracer operation",
				amount: "2500",
				currency: "USD",
			}),
		).toBe(fixture.hashVectors.commandBinding);

		expect(
			computeConfirmationNonceDigest(
				"confirmation-nonce-key-at-least-32-bytes",
				"one-time-secret-nonce-000000000001",
			),
		).toBe(fixture.hashVectors.confirmationNonce);
	});
});

describe("@86d-app/contracts conformance", () => {
	it("embeds a stable digest matching live generation", () => {
		expect(computeConformanceDigest()).toBe(CONFORMANCE_DIGEST);
		expect(CONFORMANCE_DIGEST).toMatch(/^[a-f0-9]{64}$/);
	});

	it("accepts the exact pin and rejects mismatches", () => {
		expect(() => assertConformancePin(EXPECTED_PIN)).not.toThrow();
		expect(() =>
			assertConformancePin({
				packageVersion: "0.1.0",
				digest: "0".repeat(64),
			}),
		).toThrow(/does not match/);
		expect(isCompatiblePackagePair("0.1.0")).toBe(true);
		expect(isCompatiblePackagePair("0.2.0")).toBe(false);
	});

	it("produces identical digests across two generations of the payload", () => {
		expect(computeConformanceDigest()).toBe(computeConformanceDigest());
	});
});
