import type { ChangeSet } from "@86d-app/contracts/change-set";
import { computeChangeSetReviewHash } from "@86d-app/contracts/change-set";
import type {
	Approval,
	Confirmation,
	StandingPermission,
} from "@86d-app/contracts/command";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	type CommandAuthority,
	computeCommandInputDigest,
	createCommandExecutor,
	createInMemoryCommandPersistence,
	defineCommand,
	type MemoryCommandTransaction,
} from "../command";
import {
	storeRuntimeApproveTracerCommand,
	storeRuntimeFreshConfirmationTracerCommand,
	storeRuntimeStandingPermissionTracerCommand,
	storeRuntimeTracerCommand,
} from "../commands/store-runtime-tracer";
import {
	createInMemoryCommandGrantAdapter,
	type InMemoryCommandGrantSeed,
} from "../grant-memory";
import {
	computeCommandBindingHash,
	computeConfirmationNonceDigest,
	createConfirmationProof,
} from "../grants";

const now = new Date("2026-08-11T20:00:00.000Z");
const digestKey = "store-runtime-grant-input-digest-key-0001";
const nonceDigestKey = "store-runtime-confirmation-nonce-key-001";
const target = { type: "store" as const, id: "store-authoritative" };
const actor = { type: "account" as const, id: "account-owner" };
const authoritySnapshot = {
	id: "membership-owner",
	type: "store_membership" as const,
	role: "owner",
	permissions: ["store:update"],
	businessId: "business-authoritative",
	storeId: target.id,
};

function session(sessionId = "session-human-present") {
	return {
		principal: {
			type: "session" as const,
			credentialId: "session-owner",
			sessionId,
		},
	};
}

const authority: CommandAuthority = {
	authorize: async () => ({
		ok: true,
		actor,
		authority: authoritySnapshot,
		target,
	}),
	canRead: async () => true,
};

function createExecutor(
	seed: InMemoryCommandGrantSeed = {},
	definitions = [
		storeRuntimeTracerCommand,
		storeRuntimeApproveTracerCommand,
		storeRuntimeFreshConfirmationTracerCommand,
		storeRuntimeStandingPermissionTracerCommand,
	],
) {
	let id = 0;
	const grants = createInMemoryCommandGrantAdapter({
		seed,
		nonceDigestKey,
		clock: () => now,
		createReservationId: () => `reservation-${++id}`,
	});
	return createCommandExecutor({
		plane: "store_runtime",
		definitions,
		authority,
		persistence: createInMemoryCommandPersistence({ grants }),
		digestKey,
		clock: () => now,
		createId: (kind) => `${kind}-${++id}`,
	});
}

function request(
	command: string,
	idempotencyKey: string,
	input: Record<string, boolean | string>,
	reference?: { approvalReference?: string; confirmationReference?: string },
) {
	return {
		command: { name: command, version: 1 },
		idempotencyKey,
		target: { type: "store", id: "untrusted-store-hint" },
		input,
		...reference,
	};
}

function approvalSeed(input: { value: string; fail?: boolean }): {
	changeSet: ChangeSet;
	approval: Approval;
} {
	const command = { name: "store_runtime.tracer.approve", version: 1 };
	const inputDigest = computeCommandInputDigest(digestKey, {
		plane: "store_runtime",
		command,
		target,
		input,
	});
	const baseRevisions = [{ target, revision: "revision-001" }];
	const changeSet: ChangeSet = {
		id: "change-set-001",
		version: 1,
		changeSetHashVersion: 1,
		ownerPlane: "store_runtime",
		status: "approved",
		reviewHash: "0".repeat(64),
		target,
		proposal: { command, target, inputDigest },
		baseRevisions,
		affectedTargets: [target],
		beforeSummary: { value: null },
		afterSummary: { value: input.value },
		publicEffects: ["Publishes the tracer value"],
		operationalEffects: [],
		estimatedCharges: [],
		requiredPermissions: ["store:update"],
		validationBlocks: [],
		rollbackCoverage: "database",
		createdAt: "2026-08-11T19:00:00.000Z",
		updatedAt: "2026-08-11T19:05:00.000Z",
		immutableAt: "2026-08-11T19:05:00.000Z",
	};
	changeSet.reviewHash = computeChangeSetReviewHash(changeSet);
	return {
		changeSet,
		approval: {
			id: "approval-001",
			changeSetId: changeSet.id,
			reviewHash: changeSet.reviewHash,
			baseRevisions,
			actor,
			authority: authoritySnapshot,
			approvedAt: "2026-08-11T19:05:00.000Z",
		},
	};
}

function confirmationSeed(
	input: { value: string; fail?: boolean },
	overrides: Partial<Confirmation> = {},
) {
	const command = {
		name: "store_runtime.tracer.confirm_fresh",
		version: 1,
	};
	const inputDigest = computeCommandInputDigest(digestKey, {
		plane: "store_runtime",
		command,
		target,
		input,
	});
	const disclosure = "Apply the critical Store Runtime tracer change now.";
	const bindingHash = computeCommandBindingHash({
		bindingHashVersion: 1,
		plane: "store_runtime",
		command,
		target,
		inputDigest,
		disclosure,
	});
	const nonce = "confirmation-proof-nonce-00000001";
	const confirmation: Confirmation = {
		id: "confirmation-001",
		actor,
		sessionId: "session-human-present",
		target,
		command,
		bindingHashVersion: 1,
		bindingHash,
		nonceDigest: computeConfirmationNonceDigest(nonceDigestKey, nonce),
		disclosure,
		createdAt: "2026-08-11T19:55:00.000Z",
		expiresAt: "2026-08-11T20:05:00.000Z",
		...overrides,
	};
	return {
		confirmation,
		proof: createConfirmationProof(confirmation.id, nonce),
	};
}

function standingPermission(
	overrides: Partial<StandingPermission> = {},
): StandingPermission {
	return {
		id: "standing-001",
		grantee: actor,
		grantor: actor,
		authority: authoritySnapshot,
		businessId: "business-authoritative",
		storeId: target.id,
		action: { name: "store_runtime.tracer.standing", version: 1 },
		validFrom: "2026-08-11T19:00:00.000Z",
		validUntil: "2026-08-11T21:00:00.000Z",
		perOperationAmount: "60",
		aggregateAmount: "100",
		currency: "USD",
		createdAt: "2026-08-11T19:00:00.000Z",
		...overrides,
	};
}

describe("Store Runtime plane-local grants", () => {
	it("records automatic and exact approval grants, then replays without reuse", async () => {
		const input = { value: "approved" };
		const { changeSet, approval } = approvalSeed(input);
		const executor = createExecutor({
			changeSets: [changeSet],
			approvals: [approval],
		});

		const automatic = await executor.execute(
			request("store_runtime.tracer.write", "automatic-001", {
				value: "automatic",
			}),
			session(),
		);
		const first = await executor.execute(
			request("store_runtime.tracer.approve", "approval-use-001", input, {
				approvalReference: approval.id,
			}),
			session(),
		);
		const replay = await executor.execute(
			request("store_runtime.tracer.approve", "approval-use-001", input, {
				approvalReference: approval.id,
			}),
			session(),
		);
		const reused = await executor.execute(
			request("store_runtime.tracer.approve", "approval-use-002", input, {
				approvalReference: approval.id,
			}),
			session(),
		);

		expect(automatic.ok).toBe(true);
		expect(first.ok).toBe(true);
		expect(replay).toMatchObject({ ok: true, receipt: { replayed: true } });
		expect(reused).toMatchObject({
			ok: false,
			failure: { code: "approval_invalid" },
		});
		if (!automatic.ok || !first.ok) return;
		expect(
			await executor.get(automatic.receipt.executionId, session()),
		).toMatchObject({
			ok: true,
			execution: { grantUse: { kind: "automatic" } },
		});
		expect(
			await executor.get(first.receipt.executionId, session()),
		).toMatchObject({
			ok: true,
			execution: {
				grantUse: {
					kind: "approval",
					approvalId: approval.id,
					changeSetId: changeSet.id,
				},
			},
		});
	});

	it("rejects approval hash and live base-revision drift", async () => {
		const input = { value: "approved" };
		const stale = approvalSeed(input);
		stale.approval.reviewHash = "f".repeat(64);
		const wrongHash = createExecutor({
			changeSets: [stale.changeSet],
			approvals: [stale.approval],
		});
		expect(
			await wrongHash.execute(
				request("store_runtime.tracer.approve", "approval-hash-001", input, {
					approvalReference: stale.approval.id,
				}),
				session(),
			),
		).toMatchObject({ ok: false, failure: { code: "approval_invalid" } });

		const current = approvalSeed(input);
		current.changeSet.baseRevisions = [
			{ target, revision: "different-live-revision" },
		];
		current.changeSet.reviewHash = computeChangeSetReviewHash(
			current.changeSet,
		);
		current.approval.reviewHash = current.changeSet.reviewHash;
		current.approval.baseRevisions = current.changeSet.baseRevisions;
		const baseDrift = createExecutor({
			changeSets: [current.changeSet],
			approvals: [current.approval],
		});
		expect(
			await baseDrift.execute(
				request("store_runtime.tracer.approve", "approval-base-001", input, {
					approvalReference: current.approval.id,
				}),
				session(),
			),
		).toMatchObject({ ok: false, failure: { code: "approval_invalid" } });
	});

	it("marks a base-drifted Change Set conflicted and keeps its approval invalid", async () => {
		const input = { value: "approved" };
		const command = { name: "store_runtime.tracer.conflict", version: 1 };
		const seeded = approvalSeed(input);
		seeded.changeSet.proposal.command = command;
		seeded.changeSet.proposal.inputDigest = computeCommandInputDigest(
			digestKey,
			{
				plane: "store_runtime",
				command,
				target,
				input,
			},
		);
		seeded.changeSet.reviewHash = computeChangeSetReviewHash(seeded.changeSet);
		seeded.approval.reviewHash = seeded.changeSet.reviewHash;
		let liveRevision = "revision-drifted";
		const conflictTracer = defineCommand<MemoryCommandTransaction>()({
			command,
			ownerPlane: "store_runtime",
			targetType: "store",
			actionLevel: "approve",
			admissionPolicy: { kind: "approval" },
			inputSchema: z.object({ value: z.string() }).strict(),
			resultSchema: z.object({ value: z.string() }).strict(),
			resolveGrantFacts: ({ inputDigest, target: resolvedTarget }) => {
				const disclosure = "Apply the conflict tracer.";
				return {
					bindingHashVersion: 1,
					bindingHash: computeCommandBindingHash({
						bindingHashVersion: 1,
						plane: "store_runtime",
						command,
						target: resolvedTarget,
						inputDigest,
						disclosure,
					}),
					disclosure,
					businessId: "business-authoritative",
					storeId: resolvedTarget.id,
					baseRevisions: [{ target: resolvedTarget, revision: liveRevision }],
				};
			},
			execute: async ({ input: value }) => ({ ok: true, result: value }),
		});
		const executor = createExecutor(
			{ changeSets: [seeded.changeSet], approvals: [seeded.approval] },
			[conflictTracer],
		);
		const first = await executor.execute(
			request(command.name, "approval-conflict-001", input, {
				approvalReference: seeded.approval.id,
			}),
			session(),
		);
		liveRevision = "revision-001";
		const afterRestoringRevision = await executor.execute(
			request(command.name, "approval-conflict-002", input, {
				approvalReference: seeded.approval.id,
			}),
			session(),
		);

		expect(first).toMatchObject({
			ok: false,
			failure: {
				code: "approval_invalid",
				details: { reason: "base_revision_conflict" },
			},
		});
		expect(afterRestoringRevision).toMatchObject({
			ok: false,
			failure: { code: "approval_invalid" },
		});
	});

	it("treats reordered authoritative base revisions as the same review set", async () => {
		const input = { value: "approved" };
		const command = { name: "store_runtime.tracer.reordered", version: 1 };
		const secondaryTarget = { type: "resource" as const, id: "resource-001" };
		const seeded = approvalSeed(input);
		seeded.changeSet.proposal.command = command;
		seeded.changeSet.proposal.inputDigest = computeCommandInputDigest(
			digestKey,
			{ plane: "store_runtime", command, target, input },
		);
		seeded.changeSet.baseRevisions = [
			{ target, revision: "revision-001" },
			{ target: secondaryTarget, revision: "revision-002" },
		];
		seeded.changeSet.affectedTargets = [target, secondaryTarget];
		seeded.changeSet.reviewHash = computeChangeSetReviewHash(seeded.changeSet);
		seeded.approval.reviewHash = seeded.changeSet.reviewHash;
		seeded.approval.baseRevisions = seeded.changeSet.baseRevisions;
		const reorderedTracer = defineCommand<MemoryCommandTransaction>()({
			command,
			ownerPlane: "store_runtime",
			targetType: "store",
			actionLevel: "approve",
			admissionPolicy: { kind: "approval" },
			inputSchema: z.object({ value: z.string() }).strict(),
			resultSchema: z.object({ value: z.string() }).strict(),
			resolveGrantFacts: ({ inputDigest, target: resolvedTarget }) => {
				const disclosure = "Apply the reordered tracer.";
				return {
					bindingHashVersion: 1,
					bindingHash: computeCommandBindingHash({
						bindingHashVersion: 1,
						plane: "store_runtime",
						command,
						target: resolvedTarget,
						inputDigest,
						disclosure,
					}),
					disclosure,
					businessId: "business-authoritative",
					storeId: resolvedTarget.id,
					baseRevisions: [
						{ target: secondaryTarget, revision: "revision-002" },
						{ target: resolvedTarget, revision: "revision-001" },
					],
				};
			},
			execute: async ({ input: value }) => ({ ok: true, result: value }),
		});
		const executor = createExecutor(
			{ changeSets: [seeded.changeSet], approvals: [seeded.approval] },
			[reorderedTracer],
		);

		expect(
			await executor.execute(
				request(command.name, "approval-reordered-001", input, {
					approvalReference: seeded.approval.id,
				}),
				session(),
			),
		).toMatchObject({ ok: true });
	});

	it("retains standing authority after an ambiguous handler exception", async () => {
		const command = { name: "store_runtime.tracer.ambiguous", version: 1 };
		const ambiguousTracer = defineCommand<MemoryCommandTransaction>()({
			command,
			ownerPlane: "store_runtime",
			targetType: "store",
			actionLevel: "confirm_now",
			admissionPolicy: {
				kind: "confirmation",
				standingPermission: "allowed",
				freshOnly: false,
			},
			inputSchema: z
				.object({
					value: z.string(),
					amount: z.string(),
					currency: z.string(),
				})
				.strict(),
			resultSchema: z.object({ value: z.string() }).strict(),
			resolveGrantFacts: ({ input, inputDigest, target: resolvedTarget }) => {
				const disclosure = "Run the ambiguous financial tracer.";
				return {
					bindingHashVersion: 1,
					bindingHash: computeCommandBindingHash({
						bindingHashVersion: 1,
						plane: "store_runtime",
						command,
						target: resolvedTarget,
						inputDigest,
						disclosure,
						amount: input.amount,
						currency: input.currency,
					}),
					disclosure,
					amount: input.amount,
					currency: input.currency,
					businessId: "business-authoritative",
					storeId: resolvedTarget.id,
					baseRevisions: undefined,
				};
			},
			execute: async () => {
				throw new Error("provider outcome unknown");
			},
		});
		const executor = createExecutor(
			{
				standingPermissions: [standingPermission({ action: command })],
			},
			[ambiguousTracer],
		);
		const input = { value: "charged", amount: "60", currency: "USD" };

		await expect(
			executor.execute(
				request(command.name, "ambiguous-standing-001", input),
				session(),
			),
		).rejects.toThrow("provider outcome unknown");
		expect(
			await executor.execute(
				request(command.name, "ambiguous-standing-002", input),
				session(),
			),
		).toMatchObject({
			ok: false,
			failure: { code: "standing_permission_exhausted" },
		});
	});

	it("consumes a fresh confirmation once while preserving idempotent replay", async () => {
		const input = { value: "confirmed" };
		const { confirmation, proof } = confirmationSeed(input);
		const executor = createExecutor({ confirmations: [confirmation] });
		const command = request(
			"store_runtime.tracer.confirm_fresh",
			"confirmation-use-001",
			input,
			{ confirmationReference: proof },
		);

		const first = await executor.execute(command, session());
		const replay = await executor.execute(command, session());
		const reused = await executor.execute(
			{ ...command, idempotencyKey: "confirmation-use-002" },
			session(),
		);

		expect(first.ok).toBe(true);
		expect(replay).toMatchObject({ ok: true, receipt: { replayed: true } });
		expect(reused).toMatchObject({
			ok: false,
			failure: { code: "confirmation_invalid" },
		});
	});

	it("rejects wrong confirmation actor, session, target, command, hash, nonce, and expiry", async () => {
		const input = { value: "confirmed" };
		const cases: Array<{
			name: string;
			overrides?: Partial<Confirmation>;
			proof?: string;
		}> = [
			{ name: "actor", overrides: { actor: { type: "account", id: "other" } } },
			{ name: "session", overrides: { sessionId: "other-session" } },
			{ name: "target", overrides: { target: { type: "store", id: "other" } } },
			{
				name: "command",
				overrides: {
					command: { name: "store_runtime.tracer.standing", version: 1 },
				},
			},
			{ name: "hash", overrides: { bindingHash: "e".repeat(64) } },
			{
				name: "nonce",
				proof: createConfirmationProof(
					"confirmation-001",
					"wrong-nonce-000000000000000000000",
				),
			},
			{
				name: "expiry",
				overrides: { expiresAt: "2026-08-11T19:59:00.000Z" },
			},
		];
		for (const [index, testCase] of cases.entries()) {
			const seeded = confirmationSeed(input, testCase.overrides);
			const executor = createExecutor({ confirmations: [seeded.confirmation] });
			const response = await executor.execute(
				request(
					"store_runtime.tracer.confirm_fresh",
					`confirmation-invalid-${index}`,
					input,
					{ confirmationReference: testCase.proof ?? seeded.proof },
				),
				session(),
			);
			expect(response, testCase.name).toMatchObject({
				ok: false,
				failure: { code: "confirmation_invalid" },
			});
		}

		const valid = confirmationSeed(input);
		const workloadExecutor = createExecutor({
			confirmations: [valid.confirmation],
		});
		expect(
			await workloadExecutor.execute(
				request(
					"store_runtime.tracer.confirm_fresh",
					"confirmation-workload-001",
					input,
					{ confirmationReference: valid.proof },
				),
				{
					principal: {
						type: "workload",
						credentialId: "workload-unattended",
					},
				},
			),
		).toMatchObject({
			ok: false,
			failure: { code: "confirmation_invalid" },
		});
	});

	it("serializes cap reservations, honors revocation, and releases definite failures", async () => {
		const permission = standingPermission();
		const executor = createExecutor({ standingPermissions: [permission] });
		const [first, second] = await Promise.all([
			executor.execute(
				request("store_runtime.tracer.standing", "standing-cap-001", {
					value: "first",
					amount: "60",
					currency: "USD",
				}),
				session(),
			),
			executor.execute(
				request("store_runtime.tracer.standing", "standing-cap-002", {
					value: "second",
					amount: "60",
					currency: "USD",
				}),
				session(),
			),
		]);
		expect([first, second].filter((result) => result.ok)).toHaveLength(1);
		expect([first, second].find((result) => !result.ok)).toMatchObject({
			failure: { code: "standing_permission_exhausted" },
		});

		const releaseExecutor = createExecutor({
			standingPermissions: [permission],
		});
		const failed = await releaseExecutor.execute(
			request("store_runtime.tracer.standing", "standing-release-001", {
				value: "fail",
				amount: "60",
				currency: "USD",
				fail: true,
			}),
			session(),
		);
		const afterRelease = await releaseExecutor.execute(
			request("store_runtime.tracer.standing", "standing-release-002", {
				value: "succeeds",
				amount: "60",
				currency: "USD",
			}),
			session(),
		);
		expect(failed).toMatchObject({ ok: false, receipt: { status: "failed" } });
		expect(afterRelease.ok).toBe(true);

		const revoked = createExecutor({
			standingPermissions: [
				standingPermission({ revokedAt: "2026-08-11T19:30:00.000Z" }),
			],
		});
		expect(
			await revoked.execute(
				request("store_runtime.tracer.standing", "standing-revoked-001", {
					value: "blocked",
					amount: "10",
					currency: "USD",
				}),
				session(),
			),
		).toMatchObject({
			ok: false,
			failure: { code: "confirmation_required" },
		});
	});

	it("never lets standing permission satisfy a fresh-only Command", async () => {
		const permission = standingPermission({
			action: {
				name: "store_runtime.tracer.confirm_fresh",
				version: 1,
			},
			perOperationAmount: undefined,
			aggregateAmount: undefined,
			currency: undefined,
		});
		const executor = createExecutor({ standingPermissions: [permission] });
		const response = await executor.execute(
			request("store_runtime.tracer.confirm_fresh", "fresh-only-001", {
				value: "blocked",
			}),
			session(),
		);
		expect(response).toMatchObject({
			ok: false,
			failure: { code: "confirmation_required" },
		});
	});
});
