import { describe, expect, it, vi } from "vitest";
import type { PersistedCommandExecution } from "../command";
import { createPrismaCommandPersistence } from "../command-prisma";

const startedAt = "2026-08-11T20:00:00.000Z";
const completedAt = "2026-08-11T20:00:01.000Z";
const digest = "a".repeat(64);
const databaseNull = { prisma: "DbNull" };
const jsonNull = { prisma: "JsonNull" };

const initialExecution: PersistedCommandExecution = {
	executionId: "execution-1",
	plane: "store_runtime",
	command: { name: "store_runtime.tracer.write", version: 1 },
	target: { type: "store", id: "store-1" },
	actor: { type: "account", id: "account-1" },
	authority: {
		id: "membership-1",
		type: "store_membership",
		role: "owner",
		permissions: ["store:update"],
		storeId: "store-1",
	},
	idempotencyKey: "idempotency-1",
	approvalReference: "approval-1",
	actionLevel: "approve",
	status: "running",
	requestDigestVersion: 2,
	inputDigest: digest,
	commandBindingHashVersion: 1,
	commandBindingHash: digest,
	grantUse: {
		kind: "approval",
		approvalId: "approval-1",
		changeSetId: "change-set-1",
		reviewHash: digest,
	},
	redactedInput: { value: "updated" },
	startedAt,
	auditEvents: [
		{
			id: "audit-1",
			version: 1,
			plane: "store_runtime",
			type: "command.started",
			actor: { type: "account", id: "account-1" },
			authority: {
				id: "membership-1",
				type: "store_membership",
				role: "owner",
				permissions: ["store:update"],
				storeId: "store-1",
			},
			target: { type: "store", id: "store-1" },
			command: { name: "store_runtime.tracer.write", version: 1 },
			occurredAt: startedAt,
			data: { executionId: "execution-1", inputDigest: digest },
		},
	],
};

const failedExecution: PersistedCommandExecution = {
	...initialExecution,
	status: "failed",
	completedAt,
	failure: {
		code: "execution_failed",
		message: "Command execution failed.",
		retryable: false,
	},
	auditEvents: [
		...initialExecution.auditEvents,
		{
			...initialExecution.auditEvents[0],
			id: "audit-2",
			type: "command.failed",
			occurredAt: completedAt,
			data: { executionId: "execution-1", code: "execution_failed" },
		},
	],
};

const succeededExecution: PersistedCommandExecution = {
	...initialExecution,
	status: "succeeded",
	completedAt,
	result: { value: "updated" },
	auditEvents: [
		...initialExecution.auditEvents,
		{
			...initialExecution.auditEvents[0],
			id: "audit-2",
			type: "command.succeeded",
			occurredAt: completedAt,
			data: { executionId: "execution-1" },
		},
	],
};

function executionRecord(
	status: "failed" | "running" | "succeeded" = "running",
	inputDigest = digest,
	grant: {
		actionLevel: "automatic" | "approve" | "confirm_now";
		approvalId: string | null;
		confirmationId: string | null;
	} = {
		actionLevel: "approve",
		approvalId: "approval-1",
		confirmationId: null,
	},
) {
	return {
		id: "execution-1",
		plane: "store_runtime",
		commandName: "store_runtime.tracer.write",
		commandVersion: 1,
		actionLevel: grant.actionLevel,
		idempotencyKey: "idempotency-1",
		requestDigestVersion: 2,
		approvalId: grant.approvalId,
		confirmationId: grant.confirmationId,
		inputDigest,
		commandBindingHashVersion: 1,
		commandBindingHash: digest,
		grantUse:
			grant.actionLevel === "automatic"
				? { kind: "automatic" }
				: grant.actionLevel === "approve"
					? {
							kind: "approval",
							approvalId: grant.approvalId,
							changeSetId: "change-set-1",
							reviewHash: digest,
						}
					: {
							kind: "confirmation",
							confirmationId: grant.confirmationId,
							bindingHash: digest,
						},
		redactedInput: { value: "updated" },
		actorType: "account",
		actorId: "account-1",
		actor: initialExecution.actor,
		authorityType: "store_membership",
		authorityId: "membership-1",
		authority: initialExecution.authority,
		targetType: "store",
		targetId: "store-1",
		target: initialExecution.target,
		status,
		result: status === "succeeded" ? { value: "updated" } : null,
		failure: status === "failed" ? failedExecution.failure : null,
		startedAt: new Date(startedAt),
		completedAt: status === "running" ? null : new Date(completedAt),
	};
}

function auditRecord(index = 0) {
	const event =
		failedExecution.auditEvents[index] ?? initialExecution.auditEvents[0];
	return {
		id: event.id,
		version: event.version,
		plane: event.plane,
		eventType: event.type,
		actorType: event.actor.type,
		actorId: event.actor.id,
		actor: event.actor,
		authorityType: event.authority.type,
		authorityId: event.authority.id,
		authority: event.authority,
		targetType: event.target.type,
		targetId: event.target.id,
		target: event.target,
		commandName: event.command?.name ?? null,
		commandVersion: event.command?.version ?? null,
		commandExecutionId: "execution-1",
		occurredAt: new Date(event.occurredAt),
		data: event.data,
	};
}

function transaction() {
	return {
		commandExecution: {
			create: vi.fn(async () => executionRecord()),
			findFirst: vi.fn(async () => executionRecord()),
			findUnique: vi.fn(async () => executionRecord()),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		auditEvent: {
			create: vi.fn(async () => auditRecord()),
			findMany: vi.fn(async () => [auditRecord()]),
		},
		$executeRawUnsafe: vi.fn(async (_query: string) => 0),
		async $queryRawUnsafe<T>(_query: string): Promise<T> {
			return [] as T;
		},
	};
}

function clientFor(tx: ReturnType<typeof transaction>) {
	return {
		async $transaction<T>(run: (value: typeof tx) => Promise<T>): Promise<T> {
			return run(tx);
		},
	};
}

const grants = {
	admit: async () => ({
		ok: true as const,
		grantUse: initialExecution.grantUse,
	}),
	settle: async () => undefined,
	markAmbiguous: async () => undefined,
};

function grantRequest() {
	return {
		executionId: initialExecution.executionId,
		principal: {
			type: "session" as const,
			credentialId: "session-1",
			sessionId: "session-human-present",
		},
		plane: initialExecution.plane,
		command: initialExecution.command,
		inputDigest: initialExecution.inputDigest,
		actor: initialExecution.actor,
		authority: initialExecution.authority,
		target: initialExecution.target,
		policy: { kind: "approval" as const },
		approvalReference: "approval-1",
		resolveFacts: async () => ({
			bindingHashVersion: 1,
			bindingHash: digest,
			disclosure: "Apply the reviewed tracer change.",
			baseRevisions: [{ target: initialExecution.target, revision: "one" }],
		}),
	};
}

describe("Store Runtime Prisma Command persistence", () => {
	it("claims before admission and rolls back a denied grant without running", async () => {
		const order: string[] = [];
		const tx = transaction();
		tx.commandExecution.create.mockImplementation(async () => {
			order.push("claim");
			return executionRecord();
		});
		const denyingGrants = {
			admit: vi.fn(async () => {
				order.push("admit");
				return {
					ok: false as const,
					failure: {
						code: "approval_invalid" as const,
						message: "The approval does not match.",
						retryable: false,
					},
				};
			}),
			settle: vi.fn(async () => undefined),
			markAmbiguous: vi.fn(async () => undefined),
		};
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants: denyingGrants,
		});
		const run = vi.fn(async () => ({
			commitTransaction: true,
			execution: succeededExecution,
		}));

		await expect(
			persistence.runOnce({
				scope: "opaque-executor-scope",
				inputDigest: digest,
				initialExecution,
				grant: grantRequest(),
				run,
			}),
		).resolves.toMatchObject({
			kind: "denied",
			failure: { code: "approval_invalid" },
		});
		expect(order).toEqual(["claim", "admit"]);
		expect(run).not.toHaveBeenCalled();
		expect(tx.auditEvent.create).not.toHaveBeenCalled();
	});

	it("atomically claims an execution with its started audit", async () => {
		const tx = transaction();
		const client = clientFor(tx);
		const persistence = createPrismaCommandPersistence(client, {
			databaseNull,
			jsonNull,
			grants,
		});

		const result = await persistence.runOnce({
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution,
			grant: grantRequest(),
			run: async () => ({
				commitTransaction: true,
				execution: succeededExecution,
			}),
		});

		expect(result).toMatchObject({
			kind: "execution",
			replayed: false,
		});
		expect(tx.commandExecution.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				actorId: "account-1",
				authorityId: "membership-1",
				targetId: "store-1",
				commandName: "store_runtime.tracer.write",
				approvalId: null,
				confirmationId: null,
			}),
		});
		expect(tx.auditEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				id: "audit-1",
				eventType: "command.started",
				commandExecutionId: "execution-1",
			}),
		});
	});

	it("classifies a unique-scope race as replay or digest conflict", async () => {
		const tx = transaction();
		tx.commandExecution.create.mockRejectedValue(
			Object.assign(new Error("unique"), { code: "P2002" }),
		);
		tx.commandExecution.findFirst.mockResolvedValue(
			executionRecord("succeeded"),
		);
		tx.auditEvent.findMany.mockResolvedValue([auditRecord()]);
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants,
		});
		const args = {
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution,
			grant: grantRequest(),
			run: async () => ({
				commitTransaction: true,
				execution: initialExecution,
			}),
		};

		expect(await persistence.runOnce(args)).toMatchObject({
			kind: "execution",
			replayed: true,
			execution: { status: "succeeded" },
		});

		tx.commandExecution.findFirst.mockResolvedValue(
			executionRecord("succeeded", "b".repeat(64)),
		);
		expect(await persistence.runOnce(args)).toEqual({ kind: "conflict" });
	});

	it("finds the existing principal-scoped execution after authority replacement", async () => {
		const tx = transaction();
		tx.commandExecution.create.mockRejectedValue(
			Object.assign(new Error("unique"), { code: "P2002" }),
		);
		tx.commandExecution.findFirst.mockResolvedValue(
			executionRecord("succeeded"),
		);
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants,
		});

		const replay = await persistence.runOnce({
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution: {
				...initialExecution,
				authority: {
					...initialExecution.authority,
					id: "replacement-role",
					type: "custom_role",
				},
			},
			grant: grantRequest(),
			run: async () => ({
				commitTransaction: true,
				execution: succeededExecution,
			}),
		});

		expect(replay).toMatchObject({
			kind: "execution",
			replayed: true,
			execution: {
				authority: { id: "membership-1" },
			},
		});
		expect(tx.commandExecution.findFirst).toHaveBeenCalledWith({
			where: {
				plane: "store_runtime",
				actorType: "account",
				actorId: "account-1",
				targetType: "store",
				targetId: "store-1",
				commandName: "store_runtime.tracer.write",
				commandVersion: 1,
				idempotencyKey: "idempotency-1",
			},
		});
	});

	it("rolls back handler writes while committing failure and audit", async () => {
		const tx = transaction();
		tx.commandExecution.findUnique
			.mockResolvedValueOnce(executionRecord("running"))
			.mockResolvedValueOnce(executionRecord("failed"));
		tx.auditEvent.findMany.mockResolvedValue([auditRecord(0), auditRecord(1)]);
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants,
		});

		const result = await persistence.runOnce({
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution,
			grant: grantRequest(),
			run: async (value) => {
				expect(value).toBe(tx);
				return {
					commitTransaction: false,
					execution: failedExecution,
				};
			},
		});

		expect(tx.$executeRawUnsafe.mock.calls.map(([query]) => query)).toEqual([
			'SAVEPOINT "command_handler"',
			'ROLLBACK TO SAVEPOINT "command_handler"',
			'RELEASE SAVEPOINT "command_handler"',
		]);
		expect(tx.commandExecution.updateMany).toHaveBeenCalledWith({
			where: { id: "execution-1", status: "running" },
			data: expect.objectContaining({
				status: "failed",
				result: databaseNull,
				failure: expect.objectContaining({ code: "execution_failed" }),
			}),
		});
		expect(result).toMatchObject({
			kind: "execution",
			replayed: false,
			execution: { status: "failed" },
		});
	});

	it("revalidates approval revisions in the handler transaction before running", async () => {
		const tx = transaction();
		const driftFailure = {
			code: "approval_invalid" as const,
			message: "The Change Set base revisions have changed.",
			retryable: false,
		};
		tx.commandExecution.findUnique
			.mockResolvedValueOnce(executionRecord("running"))
			.mockResolvedValueOnce({
				...executionRecord("failed"),
				failure: driftFailure,
			});
		tx.auditEvent.findMany.mockResolvedValue([auditRecord(0), auditRecord(1)]);
		const revalidatingGrants = {
			...grants,
			revalidate: vi.fn(async () => ({
				ok: false as const,
				failure: driftFailure,
			})),
			recordDenied: vi.fn(async () => undefined),
		};
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants: revalidatingGrants,
		});
		const run = vi.fn(async () => ({
			commitTransaction: true,
			execution: succeededExecution,
		}));

		const result = await persistence.runOnce({
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution,
			grant: grantRequest(),
			run,
			onGrantDenied: (failure, execution) => ({
				commitTransaction: false,
				execution: { ...execution, ...failedExecution, failure },
			}),
		});

		expect(revalidatingGrants.revalidate).toHaveBeenCalledWith(
			tx,
			expect.any(Object),
			initialExecution.grantUse,
		);
		expect(run).not.toHaveBeenCalled();
		expect(revalidatingGrants.recordDenied).toHaveBeenCalled();
		expect(result).toMatchObject({
			kind: "execution",
			execution: { status: "failed", failure: driftFailure },
		});
		expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
			'SAVEPOINT "command_handler"',
		);
	});

	it("reconstructs durable approval and confirmation references", async () => {
		const tx = transaction();
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants,
		});

		tx.commandExecution.findUnique.mockResolvedValueOnce(
			executionRecord("succeeded"),
		);
		await expect(persistence.get("execution-1")).resolves.toMatchObject({
			actionLevel: "approve",
			approvalReference: "approval-1",
		});

		tx.commandExecution.findUnique.mockResolvedValueOnce(
			executionRecord("succeeded", digest, {
				actionLevel: "confirm_now",
				approvalId: null,
				confirmationId: "confirmation-1",
			}),
		);
		await expect(persistence.get("execution-1")).resolves.toMatchObject({
			actionLevel: "confirm_now",
			confirmationReference: "confirmation-1",
		});
	});

	it("distinguishes a successful JSON null result from SQL NULL", async () => {
		const tx = transaction();
		tx.commandExecution.findUnique
			.mockResolvedValueOnce(executionRecord("running"))
			.mockResolvedValueOnce({
				...executionRecord("succeeded"),
				result: null,
			});
		const persistence = createPrismaCommandPersistence(clientFor(tx), {
			databaseNull,
			jsonNull,
			grants,
		});

		const result = await persistence.runOnce({
			scope: "opaque-executor-scope",
			inputDigest: digest,
			initialExecution,
			grant: grantRequest(),
			run: async () => ({
				commitTransaction: true,
				execution: { ...succeededExecution, result: null },
			}),
		});

		expect(tx.commandExecution.updateMany).toHaveBeenCalledWith({
			where: { id: "execution-1", status: "running" },
			data: {
				status: "succeeded",
				result: jsonNull,
				failure: databaseNull,
				completedAt: new Date(completedAt),
			},
		});
		expect(result).toMatchObject({
			kind: "execution",
			execution: { status: "succeeded", result: null },
		});
	});
});
