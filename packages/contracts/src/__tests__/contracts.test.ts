import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConformanceArtifact } from "../../scripts/generate-conformance";
import { computeChangeSetReviewHash } from "../change-set";
import {
	actionLevelSchema,
	canTransitionCommand,
	canTransitionWorkflow,
	commandRequestSchema,
	computeCommandBindingHash,
	computeCommandInputDigest,
	computeConfirmationNonceDigest,
} from "../command";
import {
	assertConformancePin,
	CONFORMANCE_DIGEST,
	CONTRACTS_ARTIFACT_VERSION,
	CONTRACTS_PACKAGE_VERSION,
	computeConformanceDigest,
	EXPECTED_PIN,
	isCompatiblePackagePair,
} from "../conformance";
import {
	assertCanonicalJson,
	canonicalJson,
	parseCanonicalJson,
} from "../serialize";
import currentFixture from "./fixtures/command-conformance.json";
import historicalArtifact from "./fixtures/conformance-0.0.42.json";

const fixtureSuites = [
	{ name: "current", fixture: currentFixture },
	{
		name: historicalArtifact.version,
		fixture: historicalArtifact.currentFixtureSuite,
	},
];

describe.each(fixtureSuites)(
	"@86d-app/contracts command surface ($name)",
	({ fixture }) => {
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
	},
);

describe.each(fixtureSuites)(
	"@86d-app/contracts digests ($name)",
	({ fixture }) => {
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
	},
);

describe("@86d-app/contracts conformance", () => {
	it("keeps the manifest, runtime, and generated artifact on one version", () => {
		const manifest: unknown = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		);
		expect(manifest).toMatchObject({ version: CONTRACTS_PACKAGE_VERSION });
		expect(CONTRACTS_ARTIFACT_VERSION).toBe(CONTRACTS_PACKAGE_VERSION);
		expect(buildConformanceArtifact(CONTRACTS_PACKAGE_VERSION).digest).toBe(
			CONFORMANCE_DIGEST,
		);
	});

	it("embeds a stable digest matching live generation", () => {
		expect(computeConformanceDigest()).toBe(CONFORMANCE_DIGEST);
		expect(CONFORMANCE_DIGEST).toMatch(/^[a-f0-9]{64}$/);
	});

	it("accepts the exact pin and rejects mismatches", () => {
		expect(() => assertConformancePin(EXPECTED_PIN)).not.toThrow();
		expect(() =>
			assertConformancePin({
				packageVersion: CONTRACTS_PACKAGE_VERSION,
				digest: "0".repeat(64),
			}),
		).toThrow(/does not match/);
		expect(() =>
			assertConformancePin({
				packageVersion: "0.0.0",
				digest: CONFORMANCE_DIGEST,
			}),
		).toThrow(/does not match/);
		expect(isCompatiblePackagePair(CONTRACTS_PACKAGE_VERSION)).toBe(true);
		expect(isCompatiblePackagePair("99.0.0")).toBe(false);
	});

	it("preserves the pre-bump compatibility matrix without collisions", () => {
		expect(buildConformanceArtifact("0.0.42").compatibilityMatrix).toEqual(
			historicalArtifact.compatibilityMatrix,
		);
	});

	it("uses the frozen previous minor fixtures in the next version", () => {
		const artifact = buildConformanceArtifact("0.1.0");
		expect(artifact.previousMinorFixtureSuite).toEqual({
			artifactVersion: "0.0.42",
			note: "Fixture suite from the 0.0.42 conformance artifact.",
			...historicalArtifact.currentFixtureSuite,
		});
		expect(artifact.compatibilityMatrix.acceptedPairs).toEqual([
			{ consumer: "0.1.0", artifact: "0.1.0" },
			{ consumer: "0.1.0", artifact: "0.0.42" },
		]);
		expect(artifact.compatibilityMatrix.rejectedPairs).not.toContainEqual({
			consumer: "0.1.0",
			artifact: "0.0.42",
			reason: "unlisted_pair",
		});
	});

	it("requires a historical fixture before advertising a later minor", () => {
		expect(() => buildConformanceArtifact("0.2.0")).toThrow(
			/Preserve the previous minor conformance artifact/,
		);
		expect(() => buildConformanceArtifact("invalid")).toThrow(
			/stable semantic version/,
		);
	});

	it("produces identical artifacts across two generations", () => {
		expect(buildConformanceArtifact("0.1.0")).toEqual(
			buildConformanceArtifact("0.1.0"),
		);
	});
});
