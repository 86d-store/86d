import { describe, expect, it } from "vitest";
import { computeCommandInputDigest } from "../command";
import {
	computeChangeSetReviewHash,
	computeCommandBindingHash,
	computeConfirmationNonceDigest,
} from "../grants";

const store = { type: "store" as const, id: "store-001" };

describe("Store Runtime grant hashes", () => {
	it("keeps the v2 keyed input digest domain-separated and grant-reference free", () => {
		expect(
			computeCommandInputDigest("command-input-vector-key-000000001", {
				plane: "store_runtime",
				command: { name: "store_runtime.inventory.adjust", version: 2 },
				target: store,
				input: { quantity: 4, sku: "SKU-001" },
			}),
		).toBe("17d373cc1cad8a869f0ec6231cd618b5beb7d1e92c22eb8e710eafc73117a053");
	});
	it("produces a stable domain-separated Change Set review hash", () => {
		const content = {
			changeSetHashVersion: 1,
			ownerPlane: "store_runtime" as const,
			target: store,
			proposal: {
				command: { name: "store_runtime.settings.publish", version: 1 },
				target: store,
				inputDigest: "a".repeat(64),
				opaqueDraftReference: "draft-001",
			},
			baseRevisions: [{ target: store, revision: "revision-7" }],
			affectedTargets: [store],
			beforeSummary: { title: "Before" },
			afterSummary: { title: "After" },
			publicEffects: ["New title"],
			operationalEffects: ["Publishes one immutable revision"],
			estimatedCharges: [],
			requiredPermissions: ["store:update"],
			validationBlocks: [],
			rollbackCoverage: "database" as const,
		};

		expect(computeChangeSetReviewHash(content)).toBe(
			"48a7781e09c5ac67ac2d36c3f58d33e9a35c12dc35299133e1765a79378c4183",
		);
		expect(
			computeChangeSetReviewHash({
				...content,
				proposal: { ...content.proposal, inputDigest: "b".repeat(64) },
			}),
		).not.toBe(computeChangeSetReviewHash(content));
	});

	it("uses a locale-independent cross-plane Change Set hash vector", () => {
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
		).toBe("eb57b61b9783ed8e5c536dda00fdda0f6ac45ede3062f66bffe546ca529f7c7f");
	});

	it("binds a confirmation to plane, Command, target, input, disclosure, and cost", () => {
		const content = {
			bindingHashVersion: 1,
			plane: "store_runtime" as const,
			command: { name: "store_runtime.tracer.confirm", version: 1 },
			target: store,
			inputDigest: "c".repeat(64),
			disclosure: "Spend USD 25.00 for a tracer operation",
			amount: "2500",
			currency: "USD",
		};

		expect(computeCommandBindingHash(content)).toBe(
			"d485960b4abd31c7bc69e236382947967b53020065aca26d7d9d907b578274a5",
		);
		expect(
			computeCommandBindingHash({ ...content, plane: "control_plane" }),
		).not.toBe(computeCommandBindingHash(content));
	});

	it("stores only a keyed, domain-separated confirmation nonce digest", () => {
		expect(
			computeConfirmationNonceDigest(
				"confirmation-nonce-key-at-least-32-bytes",
				"one-time-secret-nonce-000000000001",
			),
		).toBe("baba5e641ee38a7d0d40e78676ca21a4e29f68fdb631a43f1a0b1e0054264654");
	});
});
