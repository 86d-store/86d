import { describe, expect, it } from "vitest";
import {
	actionLevelSchema,
	approvalSchema,
	auditEventSchema,
	canTransitionCommand,
	canTransitionWorkflow,
	changeSetProposalSchema,
	changeSetSchema,
	commandRequestSchema,
	confirmationSchema,
	grantUseSchema,
	standingPermissionSchema,
	standingPermissionUseReservationSchema,
	workflowAttemptSchema,
	workflowSchema,
	workflowStepSchema,
} from "../commands";
import fixture from "./fixtures/command-conformance.json";

describe("Command contract conformance", () => {
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

	it("runtime-validates the persisted M1 records", () => {
		const now = "2026-08-11T20:00:00.000Z";
		const target = { type: "business", id: "business-fixture-001" };
		const authority = {
			id: "authority-fixture-001",
			type: "business_membership",
			permissions: ["business:update"],
			businessId: "business-fixture-001",
		};

		expect(
			workflowSchema.safeParse({
				id: "workflow-fixture-001",
				version: 1,
				name: "control_plane.store.provision",
				state: "pending",
				target,
				createdAt: now,
				updatedAt: now,
			}).success,
		).toBe(true);
		expect(
			workflowStepSchema.safeParse({
				id: "step-fixture-001",
				workflowId: "workflow-fixture-001",
				name: "claim-project",
				position: 0,
				state: "pending",
				createdAt: now,
				updatedAt: now,
			}).success,
		).toBe(true);
		expect(
			workflowAttemptSchema.safeParse({
				id: "attempt-fixture-001",
				stepId: "step-fixture-001",
				attempt: 1,
				state: "pending",
				operationKey: "provision:business-fixture-001:project",
				startedAt: now,
			}).success,
		).toBe(true);
		expect(
			changeSetSchema.safeParse({
				id: "change-set-fixture-001",
				version: 1,
				changeSetHashVersion: 1,
				ownerPlane: "control_plane",
				status: "draft",
				reviewHash: "a".repeat(64),
				target,
				proposal: {
					command: { name: "control_plane.business.update", version: 1 },
					target,
					inputDigest: "b".repeat(64),
					opaqueDraftReference: "store-runtime-draft-001",
				},
				baseRevisions: [{ target, revision: "revision-001" }],
				affectedTargets: [target],
				beforeSummary: { name: "Before" },
				afterSummary: { name: "After" },
				publicEffects: [],
				operationalEffects: ["Updates the Business name"],
				estimatedCharges: [],
				requiredPermissions: ["business:update"],
				validationBlocks: [],
				rollbackCoverage: "database",
				createdAt: now,
				updatedAt: now,
			}).success,
		).toBe(true);
		expect(
			approvalSchema.safeParse({
				id: "approval-fixture-001",
				changeSetId: "change-set-fixture-001",
				reviewHash: "a".repeat(64),
				baseRevisions: [{ target, revision: "revision-001" }],
				actor: { type: "account", id: "actor-fixture-001" },
				authority,
				approvedAt: now,
			}).success,
		).toBe(true);
		expect(
			confirmationSchema.safeParse({
				id: "confirmation-fixture-001",
				actor: { type: "account", id: "actor-fixture-001" },
				sessionId: "session-fixture-001",
				target,
				command: { name: "control_plane.business.delete", version: 1 },
				bindingHashVersion: 1,
				bindingHash: "b".repeat(64),
				nonceDigest: "c".repeat(64),
				disclosure: "Delete this Business",
				createdAt: now,
				expiresAt: "2026-08-11T20:05:00.000Z",
			}).success,
		).toBe(true);
		expect(
			standingPermissionSchema.safeParse({
				id: "permission-fixture-001",
				grantee: { type: "account", id: "actor-fixture-001" },
				grantor: { type: "account", id: "owner-fixture-001" },
				authority,
				businessId: "business-fixture-001",
				action: { name: "control_plane.label.buy", version: 1 },
				validFrom: now,
				validUntil: "2026-09-11T20:00:00.000Z",
				perOperationAmount: "2500",
				aggregateAmount: "10000",
				currency: "USD",
				createdAt: now,
			}).success,
		).toBe(true);
		expect(
			standingPermissionUseReservationSchema.safeParse({
				id: "reservation-fixture-001",
				standingPermissionId: "permission-fixture-001",
				commandExecutionId: "execution-fixture-001",
				amount: "2500",
				currency: "USD",
				state: "reserved",
				createdAt: now,
				updatedAt: now,
			}).success,
		).toBe(true);
		expect(
			auditEventSchema.safeParse({
				id: "audit-fixture-001",
				version: 1,
				plane: "control_plane",
				type: "command.succeeded",
				actor: { type: "account", id: "actor-fixture-001" },
				authority,
				target,
				command: {
					name: "control_plane.tracer.write",
					version: 1,
				},
				occurredAt: now,
				data: { executionId: "execution-fixture-001" },
			}).success,
		).toBe(true);
	});

	it("binds Change Set proposals and rejects malformed money invariants", () => {
		const target = { type: "store" as const, id: "store-001" };
		const proposal = {
			command: { name: "store_runtime.settings.publish", version: 1 },
			target,
			inputDigest: "a".repeat(64),
		};
		expect(changeSetProposalSchema.parse(proposal)).toEqual(proposal);
		expect(
			changeSetSchema.safeParse({
				id: "change-set-001",
				version: 1,
				changeSetHashVersion: 1,
				ownerPlane: "store_runtime",
				status: "draft",
				reviewHash: "b".repeat(64),
				target,
				proposal: {
					...proposal,
					target: { type: "store", id: "another-store" },
				},
				baseRevisions: [{ target, revision: "revision-001" }],
				affectedTargets: [target],
				beforeSummary: {},
				afterSummary: {},
				publicEffects: [],
				operationalEffects: [],
				estimatedCharges: [],
				requiredPermissions: [],
				validationBlocks: [],
				rollbackCoverage: "database",
				createdAt: "2026-08-11T20:00:00.000Z",
				updatedAt: "2026-08-11T20:00:00.000Z",
			}).success,
		).toBe(false);

		expect(
			standingPermissionSchema.safeParse({
				id: "permission-001",
				grantee: { type: "account", id: "actor-001" },
				grantor: { type: "account", id: "owner-001" },
				authority: {
					id: "membership-001",
					type: "store_membership",
					permissions: ["label:buy"],
					businessId: "business-001",
					storeId: "store-001",
				},
				businessId: "business-001",
				storeId: "store-001",
				action: { name: "store_runtime.label.buy", version: 1 },
				validFrom: "2026-08-11T20:00:00.000Z",
				validUntil: "2026-08-12T20:00:00.000Z",
				perOperationAmount: "0500",
				aggregateAmount: "1000",
				currency: "USD",
				createdAt: "2026-08-11T20:00:00.000Z",
			}).success,
		).toBe(false);
	});

	it("normalizes every admitted grant kind, including nonfinancial standing use", () => {
		const values = [
			{ kind: "automatic" },
			{
				kind: "approval",
				approvalId: "approval-001",
				changeSetId: "change-set-001",
				reviewHash: "a".repeat(64),
			},
			{
				kind: "confirmation",
				confirmationId: "confirmation-001",
				bindingHash: "b".repeat(64),
			},
			{
				kind: "standing_permission",
				standingPermissionId: "permission-001",
				reservationId: "reservation-001",
			},
			{
				kind: "standing_permission",
				standingPermissionId: "permission-002",
				reservationId: "reservation-002",
				amount: "2500",
				currency: "USD",
			},
		];
		for (const value of values) {
			expect(grantUseSchema.parse(value)).toEqual(value);
		}
		expect(
			grantUseSchema.safeParse({
				kind: "standing_permission",
				standingPermissionId: "permission-003",
				reservationId: "reservation-003",
				amount: "100",
			}).success,
		).toBe(false);
	});

	it("rejects unsupported review and binding hash versions", () => {
		const target = { type: "store" as const, id: "store-001" };
		expect(
			changeSetSchema.safeParse({
				id: "change-set-version-001",
				version: 1,
				changeSetHashVersion: 2,
				ownerPlane: "store_runtime",
				status: "draft",
				reviewHash: "a".repeat(64),
				target,
				proposal: {
					command: { name: "store_runtime.settings.publish", version: 1 },
					target,
					inputDigest: "b".repeat(64),
				},
				baseRevisions: [{ target, revision: "revision-001" }],
				affectedTargets: [target],
				beforeSummary: {},
				afterSummary: {},
				publicEffects: [],
				operationalEffects: [],
				estimatedCharges: [],
				requiredPermissions: [],
				validationBlocks: [],
				rollbackCoverage: "database",
				createdAt: "2026-08-11T20:00:00.000Z",
				updatedAt: "2026-08-11T20:00:00.000Z",
			}),
		).toMatchObject({ success: false });
		expect(
			confirmationSchema.safeParse({
				id: "confirmation-version-001",
				actor: { type: "account", id: "account-001" },
				sessionId: "session-001",
				target,
				command: { name: "store_runtime.tracer.confirm", version: 1 },
				bindingHashVersion: 2,
				bindingHash: "a".repeat(64),
				nonceDigest: "b".repeat(64),
				disclosure: "Confirm this action",
				createdAt: "2026-08-11T20:00:00.000Z",
				expiresAt: "2026-08-11T20:05:00.000Z",
			}),
		).toMatchObject({ success: false });
	});
});
