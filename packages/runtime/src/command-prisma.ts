import {
	actorReferenceSchema,
	auditEventSchema,
	authoritativePlaneSchema,
	authoritySnapshotSchema,
	type CommandFailure,
	commandFailureSchema,
	commandReferenceSchema,
	commandStatusSchema,
	grantUseSchema,
	jsonValueSchema,
	targetReferenceSchema,
} from "@86d-app/core/commands";
import type {
	CommandExecutionClaim,
	CommandPersistence,
	PersistedCommandExecution,
} from "./command";
import type { PrismaCommandGrantTransaction } from "./grant-prisma";
import type { CommandGrantAdapter, CommandGrantFacts } from "./grants";

type DateValue = Date | string;

interface CommandExecutionRecord {
	id: string;
	plane: string;
	commandName: string;
	commandVersion: number;
	actionLevel: string;
	idempotencyKey: string;
	requestDigestVersion: number;
	approvalId: string | null;
	confirmationId: string | null;
	inputDigest: string;
	commandBindingHashVersion: number | null;
	commandBindingHash: string | null;
	grantUse: unknown | null;
	redactedInput: unknown;
	actorType: string;
	actorId: string;
	actor: unknown;
	authorityType: string;
	authorityId: string;
	authority: unknown;
	targetType: string;
	targetId: string;
	target: unknown;
	status: string;
	result: unknown;
	failure: unknown;
	startedAt: DateValue;
	completedAt: DateValue | null;
}

interface AuditEventRecord {
	id: string;
	version: number;
	plane: string;
	eventType: string;
	actor: unknown;
	authority: unknown;
	target: unknown;
	commandName: string | null;
	commandVersion: number | null;
	workflowId?: string | null | undefined;
	occurredAt: DateValue;
	data: unknown;
}

interface CommandExecutionCreateArgs {
	data: Record<string, unknown>;
}

interface CommandExecutionFindFirstArgs {
	where: Record<string, unknown>;
}

interface CommandExecutionFindUniqueArgs {
	where: { id: string };
}

interface CommandExecutionUpdateManyArgs {
	where: { id: string; status: "running" };
	data: Record<string, unknown>;
}

interface AuditEventCreateArgs {
	data: Record<string, unknown>;
}

interface AuditEventFindManyArgs {
	where: { commandExecutionId: string };
	orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }];
}

/** Narrow generated-Prisma surface kept behind Command persistence. */
export interface PrismaCommandTransaction
	extends PrismaCommandGrantTransaction {
	commandExecution: {
		create(args: CommandExecutionCreateArgs): Promise<unknown>;
		findFirst(
			args: CommandExecutionFindFirstArgs,
		): Promise<CommandExecutionRecord | null>;
		findUnique(
			args: CommandExecutionFindUniqueArgs,
		): Promise<CommandExecutionRecord | null>;
		updateMany(
			args: CommandExecutionUpdateManyArgs,
		): Promise<{ count: number }>;
	};
	auditEvent: {
		create(args: AuditEventCreateArgs): Promise<unknown>;
		findMany(args: AuditEventFindManyArgs): Promise<AuditEventRecord[]>;
	};
	$executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface PrismaCommandClient<
	TTransaction extends PrismaCommandTransaction,
> {
	$transaction<T>(run: (transaction: TTransaction) => Promise<T>): Promise<T>;
}

interface PrismaCommandPersistenceOptions<
	TTransaction extends PrismaCommandTransaction = PrismaCommandTransaction,
> {
	/** Prisma.DbNull from the Store Runtime generated client. */
	databaseNull: unknown;
	/** Prisma.JsonNull from the Store Runtime generated client. */
	jsonNull: unknown;
	pollIntervalMs?: number | undefined;
	maxPollAttempts?: number | undefined;
	grants?: CommandGrantAdapter<TTransaction> | undefined;
}

function iso(value: DateValue): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function isUniqueConstraintError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "P2002"
	);
}

function scopeWhere(execution: CommandExecutionClaim) {
	return {
		plane: execution.plane,
		actorType: execution.actor.type,
		actorId: execution.actor.id,
		targetType: execution.target.type,
		targetId: execution.target.id,
		commandName: execution.command.name,
		commandVersion: execution.command.version,
		idempotencyKey: execution.idempotencyKey,
	};
}

function auditCreateData(
	event: PersistedCommandExecution["auditEvents"][number],
	executionId: string,
): Record<string, unknown> {
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
		commandName: event.command?.name,
		commandVersion: event.command?.version,
		commandExecutionId: executionId,
		workflowId: event.workflowId,
		occurredAt: new Date(event.occurredAt),
		data: event.data,
	};
}

function parseAudit(record: AuditEventRecord) {
	const command =
		record.commandName === null || record.commandVersion === null
			? undefined
			: { name: record.commandName, version: record.commandVersion };
	return auditEventSchema.parse({
		id: record.id,
		version: record.version,
		plane: record.plane,
		type: record.eventType,
		actor: record.actor,
		authority: record.authority,
		target: record.target,
		...(command ? { command } : {}),
		...(record.workflowId ? { workflowId: record.workflowId } : {}),
		occurredAt: iso(record.occurredAt),
		data: record.data,
	});
}

function parseExecution(
	record: CommandExecutionRecord,
	audits: AuditEventRecord[],
): PersistedCommandExecution {
	const parsedStatus = commandStatusSchema.parse(record.status);
	if (parsedStatus === "pending") {
		throw new Error(
			"Store Runtime Commands do not persist a pending execution.",
		);
	}
	const completedAt = record.completedAt ? iso(record.completedAt) : undefined;
	const result =
		parsedStatus === "succeeded"
			? jsonValueSchema.parse(record.result)
			: undefined;
	const failure =
		parsedStatus === "failed"
			? commandFailureSchema.parse(record.failure)
			: undefined;
	const actionLevel =
		record.actionLevel === "automatic" ||
		record.actionLevel === "approve" ||
		record.actionLevel === "confirm_now"
			? record.actionLevel
			: undefined;
	if (!actionLevel) throw new Error("Stored Command action level is invalid.");
	return {
		executionId: record.id,
		plane: authoritativePlaneSchema.parse(record.plane),
		command: commandReferenceSchema.parse({
			name: record.commandName,
			version: record.commandVersion,
		}),
		target: targetReferenceSchema.parse(record.target),
		actor: actorReferenceSchema.parse(record.actor),
		authority: authoritySnapshotSchema.parse(record.authority),
		idempotencyKey: record.idempotencyKey,
		...(record.approvalId ? { approvalReference: record.approvalId } : {}),
		...(record.confirmationId
			? { confirmationReference: record.confirmationId }
			: {}),
		actionLevel,
		status: parsedStatus,
		requestDigestVersion: record.requestDigestVersion,
		inputDigest: record.inputDigest,
		...(record.commandBindingHashVersion === null
			? {}
			: { commandBindingHashVersion: record.commandBindingHashVersion }),
		...(record.commandBindingHash === null
			? {}
			: { commandBindingHash: record.commandBindingHash }),
		grantUse: grantUseSchema.parse(
			record.grantUse ??
				(record.actionLevel === "automatic" ? { kind: "automatic" } : null),
		),
		redactedInput: jsonValueSchema.parse(record.redactedInput),
		startedAt: iso(record.startedAt),
		...(completedAt ? { completedAt } : {}),
		...(result === undefined ? {} : { result }),
		...(failure === undefined ? {} : { failure }),
		auditEvents: audits.map(parseAudit),
	};
}

async function loadExecution(
	transaction: PrismaCommandTransaction,
	id: string,
): Promise<PersistedCommandExecution | undefined> {
	const record = await transaction.commandExecution.findUnique({
		where: { id },
	});
	if (!record) return undefined;
	const audits = await transaction.auditEvent.findMany({
		where: { commandExecutionId: id },
		orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }],
	});
	return parseExecution(record, audits);
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function executionWithGrant(
	execution: CommandExecutionClaim,
	grantUse: PersistedCommandExecution["grantUse"],
	facts: CommandGrantFacts,
): PersistedCommandExecution {
	return {
		...execution,
		commandBindingHashVersion: facts.bindingHashVersion,
		commandBindingHash: facts.bindingHash,
		grantUse,
		...(grantUse.kind === "approval"
			? { approvalReference: grantUse.approvalId }
			: {}),
		...(grantUse.kind === "confirmation"
			? { confirmationReference: grantUse.confirmationId }
			: {}),
	};
}

class GrantAdmissionDenied extends Error {
	readonly failure: CommandFailure;

	constructor(failure: CommandFailure) {
		super(failure.message);
		this.failure = failure;
	}
}

function defaultPrismaGrantAdapter<
	T extends PrismaCommandTransaction,
>(): CommandGrantAdapter<T> {
	return {
		async admit(transaction, request) {
			const facts = await request.resolveFacts(transaction);
			if (
				request.policy.kind === "automatic" &&
				facts.bindingHashVersion === 1
			) {
				return { ok: true, grantUse: { kind: "automatic" } };
			}
			return {
				ok: false,
				failure: {
					code:
						request.policy.kind === "approval"
							? "approval_required"
							: request.policy.kind === "confirmation"
								? "confirmation_required"
								: "invalid_request",
					message: "A persisted Command grant is required.",
					retryable: false,
				},
			};
		},
		async settle() {},
		async markAmbiguous() {},
	};
}

/** Durable Store-plane adapter with DB-enforced scoped idempotency. */
export function createPrismaCommandPersistence<
	TTransaction extends PrismaCommandTransaction,
>(
	client: PrismaCommandClient<TTransaction>,
	options: PrismaCommandPersistenceOptions<TTransaction>,
): CommandPersistence<TTransaction> {
	const pollIntervalMs = options.pollIntervalMs ?? 25;
	const maxPollAttempts = options.maxPollAttempts ?? 200;
	const grants = options.grants ?? defaultPrismaGrantAdapter<TTransaction>();

	async function get(
		executionId: string,
	): Promise<PersistedCommandExecution | undefined> {
		return client.$transaction((transaction) =>
			loadExecution(transaction, executionId),
		);
	}

	async function waitForTerminal(
		executionId: string,
	): Promise<PersistedCommandExecution> {
		for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
			const execution = await get(executionId);
			if (!execution) throw new Error("Command execution not found.");
			if (execution.status !== "running") {
				return execution;
			}
			await delay(pollIntervalMs);
		}
		throw new Error("Timed out waiting for the Command execution.");
	}

	return {
		async runOnce(args) {
			let admittedExecution: PersistedCommandExecution;
			let grantWasAdmitted = false;
			try {
				admittedExecution = await client.$transaction(async (transaction) => {
					const execution = args.initialExecution;
					await transaction.commandExecution.create({
						data: {
							id: execution.executionId,
							plane: execution.plane,
							commandName: execution.command.name,
							commandVersion: execution.command.version,
							actionLevel: execution.actionLevel,
							idempotencyKey: execution.idempotencyKey,
							requestDigestVersion: execution.requestDigestVersion,
							approvalId: null,
							confirmationId: null,
							inputDigest: execution.inputDigest,
							commandBindingHashVersion: null,
							commandBindingHash: null,
							grantUse: null,
							redactedInput: execution.redactedInput,
							actorType: execution.actor.type,
							actorId: execution.actor.id,
							actor: execution.actor,
							authorityType: execution.authority.type,
							authorityId: execution.authority.id,
							authority: execution.authority,
							targetType: execution.target.type,
							targetId: execution.target.id,
							target: execution.target,
							status: "running",
							startedAt: new Date(execution.startedAt),
						},
					});
					const facts = await args.grant.resolveFacts(transaction);
					const admissionGrant = {
						...args.grant,
						resolveFacts: () => facts,
					};
					const admission = await grants.admit(transaction, admissionGrant);
					if (!admission.ok) throw new GrantAdmissionDenied(admission.failure);
					grantWasAdmitted = true;
					if (facts.bindingHashVersion !== 1) {
						throw new Error("Unsupported Command binding hash version.");
					}
					const admitted = executionWithGrant(
						execution,
						admission.grantUse,
						facts,
					);
					const attached = await transaction.commandExecution.updateMany({
						where: { id: execution.executionId, status: "running" },
						data: {
							commandBindingHashVersion: facts.bindingHashVersion,
							commandBindingHash: facts.bindingHash,
							grantUse: admission.grantUse,
							approvalId:
								admission.grantUse.kind === "approval"
									? admission.grantUse.approvalId
									: null,
							confirmationId:
								admission.grantUse.kind === "confirmation"
									? admission.grantUse.confirmationId
									: null,
						},
					});
					if (attached.count !== 1) {
						throw new Error("The Command grant claim was lost.");
					}
					const startedAudit = execution.auditEvents[0];
					if (!startedAudit) {
						throw new Error("A Command start audit is required.");
					}
					await transaction.auditEvent.create({
						data: auditCreateData(startedAudit, execution.executionId),
					});
					return admitted;
				});
			} catch (error) {
				if (error instanceof GrantAdmissionDenied) {
					const recordDenied = grants.recordDenied;
					if (recordDenied) {
						await client.$transaction(async (transaction) => {
							await recordDenied(transaction, args.grant, error.failure);
						});
					}
					return { kind: "denied", failure: error.failure };
				}
				if (!isUniqueConstraintError(error) || grantWasAdmitted) throw error;
				const existing = await client.$transaction(async (transaction) => {
					const record = await transaction.commandExecution.findFirst({
						where: scopeWhere(args.initialExecution),
					});
					if (!record) {
						throw new Error("The conflicting Command execution was not found.");
					}
					const audits = await transaction.auditEvent.findMany({
						where: { commandExecutionId: record.id },
						orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }],
					});
					return parseExecution(record, audits);
				});
				if (
					existing.inputDigest !== args.inputDigest &&
					!(
						existing.requestDigestVersion === 1 &&
						existing.inputDigest === args.legacyInputDigest
					)
				) {
					return { kind: "conflict" };
				}
				const terminal =
					existing.status === "running"
						? await waitForTerminal(existing.executionId)
						: existing;
				return { kind: "execution", replayed: true, execution: terminal };
			}

			try {
				const terminal = await client.$transaction(async (transaction) => {
					const running = await transaction.commandExecution.findUnique({
						where: { id: args.initialExecution.executionId },
					});
					if (running?.status !== "running") {
						throw new Error("Only a running Command can be completed.");
					}
					const revalidationFacts = await args.grant.resolveFacts(transaction);
					const revalidationGrant = {
						...args.grant,
						resolveFacts: () => revalidationFacts,
					};
					const revalidation = grants.revalidate
						? await grants.revalidate(
								transaction,
								revalidationGrant,
								admittedExecution.grantUse,
							)
						: ({ ok: true, grantUse: admittedExecution.grantUse } as const);
					let completed: Awaited<ReturnType<typeof args.run>>;
					if (!revalidation.ok) {
						await grants.recordDenied?.(
							transaction,
							revalidationGrant,
							revalidation.failure,
						);
						const deniedCompletion = args.onGrantDenied?.(
							revalidation.failure,
							admittedExecution,
						);
						if (!deniedCompletion) {
							throw new Error(
								"A revalidated grant denial requires a completion.",
							);
						}
						completed = deniedCompletion;
					} else {
						await transaction.$executeRawUnsafe('SAVEPOINT "command_handler"');
						try {
							completed = await args.run(transaction, admittedExecution);
							if (!completed.commitTransaction) {
								await transaction.$executeRawUnsafe(
									'ROLLBACK TO SAVEPOINT "command_handler"',
								);
							}
						} catch (error) {
							await transaction.$executeRawUnsafe(
								'ROLLBACK TO SAVEPOINT "command_handler"',
							);
							throw error;
						} finally {
							await transaction.$executeRawUnsafe(
								'RELEASE SAVEPOINT "command_handler"',
							);
						}
					}
					await grants.settle(
						transaction,
						admittedExecution.executionId,
						completed.commitTransaction ? "succeeded" : "definite_failure",
					);

					const execution = completed.execution;
					if (
						execution.status !== "succeeded" &&
						execution.status !== "failed"
					) {
						throw new Error("A Command completion must be terminal.");
					}
					const completedAt = execution.completedAt;
					if (!completedAt)
						throw new Error("A completed Command needs a timestamp.");
					const updated = await transaction.commandExecution.updateMany({
						where: {
							id: args.initialExecution.executionId,
							status: "running",
						},
						data:
							execution.status === "succeeded"
								? {
										status: "succeeded",
										result: execution.result ?? options.jsonNull,
										failure: options.databaseNull,
										completedAt: new Date(completedAt),
									}
								: {
										status: "failed",
										result: options.databaseNull,
										failure: execution.failure ?? options.jsonNull,
										completedAt: new Date(completedAt),
									},
					});
					if (updated.count !== 1) {
						throw new Error("The Command completion claim was lost.");
					}
					const finalAudit = execution.auditEvents.at(-1);
					if (!finalAudit || finalAudit.id === execution.auditEvents[0]?.id) {
						throw new Error("A terminal Command audit is required.");
					}
					await transaction.auditEvent.create({
						data: auditCreateData(finalAudit, execution.executionId),
					});
					const stored = await loadExecution(
						transaction,
						execution.executionId,
					);
					if (!stored) throw new Error("The completed Command was not found.");
					return stored;
				});

				return { kind: "execution", replayed: false, execution: terminal };
			} catch (error) {
				try {
					await client.$transaction((transaction) =>
						grants.markAmbiguous(transaction, admittedExecution.executionId),
					);
				} catch {
					// Preserve the original persistence error; recovery can reconcile later.
				}
				throw error;
			}
		},

		get,
	};
}
