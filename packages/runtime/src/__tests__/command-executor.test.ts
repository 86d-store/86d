import { computeCommandBindingHash } from "@86d-app/contracts/command";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	type CommandAuthority,
	createCommandExecutor,
	createInMemoryCommandPersistence,
	defineCommand,
	type MemoryCommandTransaction,
} from "../command";
import type { CommandGrantAdapter } from "../grants";

const fixedNow = new Date("2026-08-11T20:00:00.000Z");
const digestKey = "command-conformance-digest-key-0001";

function request(
	idempotencyKey: string,
	input: Record<string, boolean | string>,
) {
	return {
		command: { name: "store_runtime.tracer.write", version: 1 },
		idempotencyKey,
		target: { type: "store", id: "store-client-hint" },
		input,
	};
}

function principal(credentialId = "session-owner") {
	return {
		principal: {
			type: "session" as const,
			credentialId,
			sessionId: "session-human-present",
		},
	};
}

function createHarness(options?: {
	onSlowExecution?: (() => Promise<void>) | undefined;
	actionLevel?: "automatic" | "approve" | "confirm_now" | undefined;
	grants?: CommandGrantAdapter<MemoryCommandTransaction> | undefined;
}) {
	let executions = 0;
	let ids = 0;
	let authorityId = "membership-server-derived";
	let authorityType: "custom_role" | "store_membership" = "store_membership";
	const persistence = createInMemoryCommandPersistence({
		grants: options?.grants,
	});
	const authority: CommandAuthority = {
		authorize: async ({ principal: serverPrincipal }) => {
			if (serverPrincipal.credentialId !== "session-owner") {
				return {
					ok: false,
					failure: {
						code: "forbidden",
						message: "The actor cannot use this target.",
						retryable: false,
					},
				};
			}
			return {
				ok: true,
				actor: { type: "account", id: "account-server-derived" },
				authority: {
					id: authorityId,
					type: authorityType,
					role: "owner",
					permissions: ["store:update"],
					storeId: "store-authoritative",
				},
				target: { type: "store", id: "store-authoritative" },
			};
		},
		canRead: async ({ principal: serverPrincipal, execution }) =>
			serverPrincipal.credentialId === "session-owner" &&
			execution.actor.id === "account-server-derived",
	};
	const tracer = defineCommand<MemoryCommandTransaction>()({
		command: { name: "store_runtime.tracer.write", version: 1 },
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: options?.actionLevel ?? "automatic",
		admissionPolicy:
			options?.actionLevel === "approve"
				? { kind: "approval" }
				: options?.actionLevel === "confirm_now"
					? {
							kind: "confirmation",
							standingPermission: "forbidden",
							freshOnly: true,
						}
					: { kind: "automatic" },
		inputSchema: z
			.object({
				mode: z.enum(["write", "read", "fail"]),
				value: z.string().max(100).optional(),
				secret: z.string().max(100).optional(),
				authorization: z.string().max(100).optional(),
				cookie: z.string().max(100).optional(),
				api_key: z.string().max(100).optional(),
			})
			.strict(),
		resultSchema: z
			.object({
				value: z.string().nullable(),
				actorId: z.string(),
				targetId: z.string(),
				key: z.string().optional(),
			})
			.strict(),
		failureDetailsSchema: z.object({ reason: z.string().max(100) }).strict(),
		sensitiveInputPaths: ["secret"],
		sensitiveResultPaths: ["key"],
		resolveGrantFacts: async ({ inputDigest, target }) => {
			const disclosure = "Apply the Store Runtime tracer change.";
			return {
				bindingHashVersion: 1,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: { name: "store_runtime.tracer.write", version: 1 },
					target,
					inputDigest,
					disclosure,
				}),
				disclosure,
				businessId: "business-authoritative",
				storeId: target.id,
				baseRevisions: [{ target, revision: "revision-001" }],
			};
		},
		execute: async ({ actor, input, target, transaction }) => {
			executions += 1;
			if (input.value === "slow") {
				await options?.onSlowExecution?.();
			}
			if (input.mode === "fail") {
				transaction.set("tracer:value", input.value ?? "changed-before-error");
				throw new Error("internal-canary-error");
			}
			if (input.mode === "write") {
				transaction.set("tracer:value", input.value ?? "");
			}
			return {
				ok: true,
				result: {
					value: transaction.get("tracer:value"),
					actorId: actor.id,
					targetId: target.id,
					...(input.secret ? { key: "command-result-canary" } : {}),
				},
			};
		},
	});
	const executor = createCommandExecutor({
		plane: "store_runtime",
		definitions: [tracer],
		authority,
		persistence,
		digestKey,
		clock: () => fixedNow,
		createId: (kind) => `${kind}-${++ids}`,
	});

	return {
		executor,
		setAuthority(
			nextAuthorityId: string,
			nextAuthorityType: "custom_role" | "store_membership",
		) {
			authorityId = nextAuthorityId;
			authorityType = nextAuthorityType;
		},
		get executions() {
			return executions;
		},
	};
}

describe("Store Runtime Command executor", () => {
	it("derives actor, authority, and target exclusively on the server", async () => {
		const harness = createHarness();
		const response = await harness.executor.execute(
			request("authority-001", { mode: "write", value: "alpha" }),
			principal(),
		);

		expect(response.ok).toBe(true);
		if (!response.ok || response.receipt.status !== "succeeded") return;
		expect(response.receipt.target.id).toBe("store-authoritative");
		expect(response.receipt.result).toEqual({
			value: "alpha",
			actorId: "account-server-derived",
			targetId: "store-authoritative",
		});

		const reconstruction = await harness.executor.get(
			response.receipt.executionId,
			principal(),
		);
		expect(reconstruction.ok).toBe(true);
		if (!reconstruction.ok) return;
		expect(reconstruction.execution.actor.id).toBe("account-server-derived");
		expect(reconstruction.execution.authority.id).toBe(
			"membership-server-derived",
		);
	});

	it("rejects request actor injection before authorization or execution", async () => {
		const harness = createHarness();
		const response = await harness.executor.execute(
			{
				...request("actor-injection-001", {
					mode: "write",
					value: "alpha",
				}),
				actor: { type: "account", id: "attacker-selected" },
			},
			principal(),
		);

		expect(response).toMatchObject({
			ok: false,
			failure: { code: "invalid_request", retryable: false },
		});
		expect(harness.executions).toBe(0);
	});

	it("executes concurrent identical requests once and replays the result", async () => {
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const harness = createHarness({
			onSlowExecution: async () => {
				entered?.();
				await gate;
			},
		});
		const command = request("concurrent-001", {
			mode: "write",
			value: "slow",
		});

		const first = harness.executor.execute(command, principal());
		await started;
		const second = harness.executor.execute(command, principal());
		release?.();
		const [firstResponse, secondResponse] = await Promise.all([first, second]);

		expect(firstResponse.ok).toBe(true);
		expect(secondResponse.ok).toBe(true);
		expect(harness.executions).toBe(1);
		if (!firstResponse.ok || !secondResponse.ok) return;
		expect(firstResponse.receipt.executionId).toBe(
			secondResponse.receipt.executionId,
		);
		expect(
			[firstResponse.receipt.replayed, secondResponse.receipt.replayed].sort(),
		).toEqual([false, true]);

		const replay = await harness.executor.execute(command, principal());
		expect(replay.ok).toBe(true);
		if (!replay.ok) return;
		expect(replay.receipt.replayed).toBe(true);
		expect(harness.executions).toBe(1);
	});

	it("replays the same principal request after its satisfying authority changes", async () => {
		const harness = createHarness();
		const command = request("authority-change-replay-001", {
			mode: "write",
			value: "alpha",
		});

		const first = await harness.executor.execute(command, principal());
		harness.setAuthority("replacement-role", "custom_role");
		const replay = await harness.executor.execute(command, principal());

		expect(first.ok).toBe(true);
		expect(replay.ok).toBe(true);
		if (!first.ok || !replay.ok) return;
		expect(replay.receipt.executionId).toBe(first.receipt.executionId);
		expect(replay.receipt.replayed).toBe(true);
		expect(harness.executions).toBe(1);

		const reconstruction = await harness.executor.get(
			first.receipt.executionId,
			principal(),
		);
		expect(reconstruction).toMatchObject({
			ok: true,
			execution: {
				authority: { id: "membership-server-derived" },
			},
		});
	});

	it("returns an idempotency conflict for the same key and different input", async () => {
		const harness = createHarness();
		await harness.executor.execute(
			request("conflict-001", { mode: "write", value: "alpha" }),
			principal(),
		);
		const response = await harness.executor.execute(
			request("conflict-001", { mode: "write", value: "beta" }),
			principal(),
		);

		expect(response).toMatchObject({
			ok: false,
			failure: { code: "idempotency_conflict", retryable: false },
		});
		expect(harness.executions).toBe(1);
	});

	it("conflicts on changed input after the satisfying authority changes", async () => {
		const harness = createHarness();
		await harness.executor.execute(
			request("authority-change-conflict-001", {
				mode: "write",
				value: "alpha",
			}),
			principal(),
		);
		harness.setAuthority("replacement-role", "custom_role");

		const response = await harness.executor.execute(
			request("authority-change-conflict-001", {
				mode: "write",
				value: "beta",
			}),
			principal(),
		);

		expect(response).toMatchObject({
			ok: false,
			failure: { code: "idempotency_conflict", retryable: false },
		});
		expect(harness.executions).toBe(1);
	});

	it("keeps an unexpected handler exception ambiguous and rolls back local state", async () => {
		const harness = createHarness();
		await expect(
			harness.executor.execute(
				request("rollback-001", {
					mode: "fail",
					value: "must-not-commit",
				}),
				principal(),
			),
		).rejects.toThrow("internal-canary-error");

		const read = await harness.executor.execute(
			request("rollback-read-001", { mode: "read" }),
			principal(),
		);
		expect(read.ok).toBe(true);
		if (!read.ok || read.receipt.status !== "succeeded") return;
		expect(read.receipt.result).toMatchObject({ value: null });
	});

	it("stores only keyed digests and redacted summaries for sensitive input and result", async () => {
		const harness = createHarness();
		const response = await harness.executor.execute(
			request("redaction-001", {
				mode: "write",
				value: "alpha",
				secret: "command-input-canary",
				authorization: "Bearer authorization-canary",
				cookie: "cookie-canary",
				api_key: "api-key-canary",
			}),
			principal(),
		);
		expect(response.ok).toBe(true);
		if (!response.ok) return;

		const reconstruction = await harness.executor.get(
			response.receipt.executionId,
			principal(),
		);
		expect(reconstruction.ok).toBe(true);
		if (!reconstruction.ok) return;
		const serialized = JSON.stringify(reconstruction.execution);
		expect(serialized).not.toContain("command-input-canary");
		expect(serialized).not.toContain("command-result-canary");
		expect(serialized).not.toContain("authorization-canary");
		expect(serialized).not.toContain("cookie-canary");
		expect(serialized).not.toContain("api-key-canary");
		expect(reconstruction.execution.redactedInput).toMatchObject({
			secret: "[REDACTED]",
			authorization: "[REDACTED]",
			cookie: "[REDACTED]",
			api_key: "[REDACTED]",
		});
		expect(reconstruction.execution).toMatchObject({
			result: { key: "[REDACTED]" },
		});
		expect(reconstruction.execution.inputDigest).toMatch(/^[a-f0-9]{64}$/);
		expect(
			reconstruction.execution.auditEvents.map((event) => event.type),
		).toEqual(["command.started", "command.succeeded"]);
		expect(Object.keys(harness.executor).sort()).toEqual(["execute", "get"]);
	});

	it("lets an injected grant adapter validate approval-gated commands", async () => {
		let evaluated:
			| Parameters<CommandGrantAdapter<MemoryCommandTransaction>["admit"]>[1]
			| undefined;
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async (_transaction, input) => {
				evaluated = input;
				return {
					ok: true,
					grantUse: {
						kind: "approval",
						approvalId: input.approvalReference ?? "missing",
						changeSetId: "change-set-001",
						reviewHash: "a".repeat(64),
					},
				};
			},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const harness = createHarness({ actionLevel: "approve", grants });
		const response = await harness.executor.execute(
			{
				...request("approval-001", { mode: "write", value: "approved" }),
				approvalReference: "approval-verified-001",
			},
			principal(),
		);

		expect(response.ok).toBe(true);
		expect(harness.executions).toBe(1);
		expect(evaluated).toMatchObject({
			principal: principal().principal,
			command: { name: "store_runtime.tracer.write", version: 1 },
			policy: { kind: "approval" },
			actor: { type: "account", id: "account-server-derived" },
			target: { type: "store", id: "store-authoritative" },
			approvalReference: "approval-verified-001",
		});
		expect(evaluated?.inputDigest).toMatch(/^[a-f0-9]{64}$/);
		if (!response.ok) return;
		const reconstruction = await harness.executor.get(
			response.receipt.executionId,
			principal(),
		);
		expect(reconstruction).toMatchObject({
			ok: true,
			execution: { approvalReference: "approval-verified-001" },
		});
	});

	it("persists a validated confirmation reference", async () => {
		const grants: CommandGrantAdapter<MemoryCommandTransaction> = {
			admit: async (_transaction, input) =>
				input.confirmationReference === "confirmation-verified-001"
					? {
							ok: true,
							grantUse: {
								kind: "confirmation",
								confirmationId: input.confirmationReference,
								bindingHash: "b".repeat(64),
							},
						}
					: {
							ok: false,
							failure: {
								code: "confirmation_required",
								message: "A validated confirmation is required.",
								retryable: false,
							},
						},
			settle: async () => undefined,
			markAmbiguous: async () => undefined,
		};
		const harness = createHarness({ actionLevel: "confirm_now", grants });
		const response = await harness.executor.execute(
			{
				...request("confirmation-granted-001", {
					mode: "write",
					value: "confirmed",
				}),
				confirmationReference: "confirmation-verified-001",
			},
			principal(),
		);

		expect(response.ok).toBe(true);
		if (!response.ok) return;
		const reconstruction = await harness.executor.get(
			response.receipt.executionId,
			principal(),
		);
		expect(reconstruction).toMatchObject({
			ok: true,
			execution: { confirmationReference: "confirmation-verified-001" },
		});
	});

	it("rejects references that do not belong to the action level", async () => {
		const cases = [
			{
				actionLevel: "automatic" as const,
				references: { approvalReference: "approval-wrong-action" },
			},
			{
				actionLevel: "automatic" as const,
				references: { confirmationReference: "confirmation-wrong-action" },
			},
			{
				actionLevel: "approve" as const,
				references: { confirmationReference: "confirmation-wrong-action" },
			},
			{
				actionLevel: "confirm_now" as const,
				references: { approvalReference: "approval-wrong-action" },
			},
		];

		for (const [index, testCase] of cases.entries()) {
			const harness = createHarness({
				actionLevel: testCase.actionLevel,
				grants: {
					admit: async () => ({
						ok: true,
						grantUse: { kind: "automatic" },
					}),
					settle: async () => undefined,
					markAmbiguous: async () => undefined,
				},
			});
			const response = await harness.executor.execute(
				{
					...request(`reference-mismatch-${index}`, {
						mode: "write",
						value: "must-not-execute",
					}),
					...testCase.references,
				},
				principal(),
			);

			expect(response).toMatchObject({
				ok: false,
				failure: { code: "invalid_request", retryable: false },
			});
			expect(harness.executions).toBe(0);
		}
	});

	it("requires a grant by default for non-automatic commands", async () => {
		const harness = createHarness({ actionLevel: "confirm_now" });
		const response = await harness.executor.execute(
			request("confirmation-001", { mode: "write", value: "blocked" }),
			principal(),
		);

		expect(response).toMatchObject({
			ok: false,
			failure: { code: "confirmation_required", retryable: false },
		});
		expect(harness.executions).toBe(0);
	});

	it("denies unauthorized actors without side effects", async () => {
		const harness = createHarness();
		const response = await harness.executor.execute(
			request("forbidden-001", { mode: "write", value: "alpha" }),
			principal("session-nonmember"),
		);

		expect(response).toMatchObject({
			ok: false,
			failure: { code: "forbidden" },
		});
		expect(harness.executions).toBe(0);
	});
});
