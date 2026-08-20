import { createHmac, randomUUID } from "node:crypto";
import {
	type ActionLevel,
	type ActorReference,
	type AuditEvent,
	type AuthoritativePlane,
	type AuthoritySnapshot,
	actorReferenceSchema,
	authoritySnapshotSchema,
	type CommandExecutionResponse,
	type CommandFailure,
	type CommandReference,
	type CommandRequest,
	commandFailureSchema,
	commandReferenceSchema,
	commandRequestSchema,
	type GrantUse,
	type JsonValue,
	jsonValueSchema,
	type TargetReference,
	targetReferenceSchema,
} from "@86d-app/core/commands";
import {
	type CommandAdmissionPolicy,
	type CommandGrantAdapter,
	type CommandGrantAdmissionRequest,
	type CommandGrantFacts,
	computeCommandBindingHash,
	validateCommandGrantFacts,
} from "./grants";

type ParseResult<T> =
	| { success: true; data: T }
	| { success: false; error: unknown };

type RuntimeSchema<T = unknown> = {
	safeParse(value: unknown): ParseResult<T>;
};

export type CommandPrincipal =
	| {
			type: "session";
			credentialId: string;
			sessionId: string;
	  }
	| {
			type: "workload";
			credentialId: string;
	  }
	| {
			type: "system";
			credentialId: string;
	  };

export interface CommandExecutionContext {
	principal: CommandPrincipal;
}

export type CommandAuthorizationResult =
	| {
			ok: true;
			actor: ActorReference;
			authority: AuthoritySnapshot;
			target: TargetReference;
	  }
	| {
			ok: false;
			failure: CommandFailure;
	  };

export interface CommandAuthority {
	authorize(args: {
		principal: CommandPrincipal;
		request: CommandRequest;
		definition: CommandDefinitionReference;
	}): Promise<CommandAuthorizationResult>;
	canRead(args: {
		principal: CommandPrincipal;
		execution: PersistedCommandExecution;
	}): Promise<boolean>;
}

export interface CommandDefinitionReference {
	command: CommandReference;
	ownerPlane: AuthoritativePlane;
	targetType: TargetReference["type"];
	actionLevel: ActionLevel;
	admissionPolicy: CommandAdmissionPolicy;
}

type CommandHandlerResult<TResult, TFailureDetails> =
	| { ok: true; result: TResult }
	| {
			ok: false;
			failure: Omit<CommandFailure, "details"> & {
				details?: TFailureDetails | undefined;
			};
	  };

type NormalizedCommandOutcome =
	| { ok: true; result: JsonValue }
	| { ok: false; failure: CommandFailure };

export type CommandInvocation = Readonly<{
	executionId: string;
	idempotencyKey: string;
}>;

interface TypedCommandDefinition<
	TTransaction,
	TInput,
	TResult,
	TFailureDetails,
> {
	command: CommandReference;
	ownerPlane: AuthoritativePlane;
	targetType: TargetReference["type"];
	actionLevel: ActionLevel;
	admissionPolicy?: CommandAdmissionPolicy | undefined;
	inputSchema: RuntimeSchema<TInput>;
	resultSchema: RuntimeSchema<TResult>;
	failureDetailsSchema?: RuntimeSchema<TFailureDetails> | undefined;
	sensitiveInputPaths?: readonly string[] | undefined;
	sensitiveResultPaths?: readonly string[] | undefined;
	resolveGrantFacts?:
		| ((args: {
				actor: ActorReference;
				authority: AuthoritySnapshot;
				target: TargetReference;
				input: TInput;
				inputDigest: string;
				transaction: TTransaction;
		  }) => Promise<CommandGrantFacts> | CommandGrantFacts)
		| undefined;
	execute(args: {
		actor: ActorReference;
		authority: AuthoritySnapshot;
		target: TargetReference;
		input: TInput;
		transaction: TTransaction;
		invocation: CommandInvocation;
	}): Promise<CommandHandlerResult<TResult, TFailureDetails>>;
}

export interface DefinedCommand<TTransaction>
	extends CommandDefinitionReference {
	sensitiveInputPaths?: readonly string[] | undefined;
	sensitiveResultPaths: readonly string[];
	parseInput(value: unknown): ParseResult<JsonValue>;
	resolveGrantFacts(args: {
		actor: ActorReference;
		authority: AuthoritySnapshot;
		target: TargetReference;
		input: JsonValue;
		inputDigest: string;
		transaction: TTransaction;
	}): Promise<CommandGrantFacts>;
	execute(args: {
		actor: ActorReference;
		authority: AuthoritySnapshot;
		target: TargetReference;
		input: JsonValue;
		transaction: TTransaction;
		invocation: CommandInvocation;
	}): Promise<NormalizedCommandOutcome>;
}

/**
 * Define a Command while preserving inference for its validated input, result,
 * failure details, and transaction adapter.
 */
export function defineCommand<TTransaction>() {
	return <TInput, TResult, TFailureDetails = never>(
		definition: TypedCommandDefinition<
			TTransaction,
			TInput,
			TResult,
			TFailureDetails
		>,
	): DefinedCommand<TTransaction> => {
		const admissionPolicy =
			definition.admissionPolicy ??
			defaultAdmissionPolicy(definition.actionLevel);
		if (
			(definition.actionLevel === "automatic" &&
				admissionPolicy.kind !== "automatic") ||
			(definition.actionLevel === "approve" &&
				admissionPolicy.kind !== "approval") ||
			(definition.actionLevel === "confirm_now" &&
				admissionPolicy.kind !== "confirmation")
		) {
			throw new Error("Command admission policy must match its action level.");
		}
		if (
			admissionPolicy.kind === "confirmation" &&
			admissionPolicy.freshOnly &&
			admissionPolicy.standingPermission !== "forbidden"
		) {
			throw new Error("A fresh-only Command must forbid standing permission.");
		}
		if (
			(admissionPolicy.kind === "approval" ||
				(admissionPolicy.kind === "confirmation" &&
					admissionPolicy.standingPermission === "allowed")) &&
			!definition.resolveGrantFacts
		) {
			throw new Error(
				"Approval and standing-permission Commands require plane-local grant facts.",
			);
		}
		return {
			command: definition.command,
			ownerPlane: definition.ownerPlane,
			targetType: definition.targetType,
			actionLevel: definition.actionLevel,
			admissionPolicy,
			sensitiveInputPaths: definition.sensitiveInputPaths,
			sensitiveResultPaths: definition.sensitiveResultPaths ?? [],
			parseInput(value) {
				const parsedInput = definition.inputSchema.safeParse(value);
				if (!parsedInput.success) {
					return { success: false, error: parsedInput.error };
				}
				return jsonValueSchema.safeParse(parsedInput.data);
			},
			async resolveGrantFacts(args) {
				const parsedInput = definition.inputSchema.safeParse(args.input);
				if (!parsedInput.success) {
					throw new Error(
						"Cannot resolve grant facts for invalid Command input.",
					);
				}
				let facts: CommandGrantFacts;
				if (definition.resolveGrantFacts) {
					facts = await definition.resolveGrantFacts({
						...args,
						input: parsedInput.data,
					});
				} else {
					const disclosure = `Execute ${definition.command.name} for ${args.target.type} ${args.target.id}.`;
					facts = {
						bindingHashVersion: 1,
						disclosure,
						bindingHash: computeCommandBindingHash({
							bindingHashVersion: 1,
							plane: definition.ownerPlane,
							command: definition.command,
							target: args.target,
							inputDigest: args.inputDigest,
							disclosure,
						}),
						...(args.authority.businessId
							? { businessId: args.authority.businessId }
							: {}),
						...(args.authority.storeId
							? { storeId: args.authority.storeId }
							: {}),
						baseRevisions: undefined,
					};
				}
				return validateCommandGrantFacts(facts, {
					plane: definition.ownerPlane,
					command: definition.command,
					target: args.target,
					inputDigest: args.inputDigest,
				});
			},
			async execute(args) {
				const parsedInput = definition.inputSchema.safeParse(args.input);
				if (!parsedInput.success) {
					return {
						ok: false,
						failure: commandFailure(
							"invalid_input",
							"Command input is invalid.",
						),
					};
				}

				const outcome = await definition.execute({
					actor: args.actor,
					authority: args.authority,
					target: args.target,
					input: parsedInput.data,
					transaction: args.transaction,
					invocation: args.invocation,
				});
				if (outcome.ok) {
					const parsedResult = definition.resultSchema.safeParse(
						outcome.result,
					);
					if (!parsedResult.success) {
						return {
							ok: false,
							failure: commandFailure(
								"invalid_result",
								"Command returned an invalid result.",
							),
						};
					}
					const jsonResult = jsonValueSchema.safeParse(parsedResult.data);
					if (!jsonResult.success) {
						return {
							ok: false,
							failure: commandFailure(
								"invalid_result",
								"Command returned an invalid result.",
							),
						};
					}
					return { ok: true, result: jsonResult.data };
				}

				const parsedFailure = commandFailureSchema.safeParse(outcome.failure);
				if (!parsedFailure.success) {
					return {
						ok: false,
						failure: commandFailure(
							"execution_failed",
							"Command execution failed.",
						),
					};
				}
				const detailsAreValid =
					parsedFailure.data.details === undefined ||
					definition.failureDetailsSchema?.safeParse(parsedFailure.data.details)
						.success === true;
				if (!detailsAreValid) {
					return {
						ok: false,
						failure: commandFailure(
							"execution_failed",
							"Command execution failed.",
						),
					};
				}
				return { ok: false, failure: parsedFailure.data };
			},
		};
	};
}

function defaultAdmissionPolicy(
	actionLevel: ActionLevel,
): CommandAdmissionPolicy {
	if (actionLevel === "automatic") return { kind: "automatic" };
	if (actionLevel === "approve") return { kind: "approval" };
	return {
		kind: "confirmation",
		standingPermission: "forbidden",
		freshOnly: true,
	};
}

export interface PersistedCommandExecution {
	executionId: string;
	plane: AuthoritativePlane;
	command: CommandReference;
	target: TargetReference;
	actor: ActorReference;
	authority: AuthoritySnapshot;
	idempotencyKey: string;
	approvalReference?: string | undefined;
	confirmationReference?: string | undefined;
	actionLevel: ActionLevel;
	status: "running" | "succeeded" | "failed";
	requestDigestVersion: number;
	inputDigest: string;
	commandBindingHashVersion?: number | undefined;
	commandBindingHash?: string | undefined;
	grantUse: GrantUse;
	redactedInput: JsonValue;
	startedAt: string;
	completedAt?: string | undefined;
	result?: JsonValue | undefined;
	failure?: CommandFailure | undefined;
	auditEvents: AuditEvent[];
}

export type CommandExecutionClaim = Omit<
	PersistedCommandExecution,
	| "approvalReference"
	| "confirmationReference"
	| "commandBindingHashVersion"
	| "commandBindingHash"
	| "grantUse"
>;

type PersistenceCompletion = {
	execution: PersistedCommandExecution;
	commitTransaction: boolean;
};

type PersistenceRunResult =
	| { kind: "conflict" }
	| { kind: "denied"; failure: CommandFailure }
	| {
			kind: "execution";
			replayed: boolean;
			execution: PersistedCommandExecution;
	  };

/** Persistence seam kept behind the two-method Command executor interface. */
export interface CommandPersistence<TTransaction> {
	runOnce(args: {
		scope: string;
		inputDigest: string;
		legacyInputDigest?: string | undefined;
		initialExecution: CommandExecutionClaim;
		grant: CommandGrantAdmissionRequest<TTransaction>;
		run(
			transaction: TTransaction,
			execution: PersistedCommandExecution,
		): Promise<PersistenceCompletion>;
		onGrantDenied?(
			failure: CommandFailure,
			execution: PersistedCommandExecution,
		): PersistenceCompletion;
	}): Promise<PersistenceRunResult>;
	get(executionId: string): Promise<PersistedCommandExecution | undefined>;
}

export interface MemoryCommandTransaction {
	get(key: string): string | null;
	set(key: string, value: string): void;
	delete(key: string): void;
}

function cloneExecution(
	execution: PersistedCommandExecution,
): PersistedCommandExecution {
	return structuredClone(execution);
}

function executionWithGrant(
	execution: CommandExecutionClaim,
	grantUse: GrantUse,
	commandBindingHashVersion: number,
	commandBindingHash: string,
): PersistedCommandExecution {
	return {
		...execution,
		commandBindingHashVersion,
		commandBindingHash,
		grantUse,
		...(grantUse.kind === "approval"
			? { approvalReference: grantUse.approvalId }
			: {}),
		...(grantUse.kind === "confirmation"
			? { confirmationReference: grantUse.confirmationId }
			: {}),
	};
}

function defaultCommandGrantAdapter<
	TTransaction,
>(): CommandGrantAdapter<TTransaction> {
	return {
		async admit(transaction, request) {
			if (request.policy.kind === "automatic") {
				const facts = await request.resolveFacts(transaction);
				if (facts.bindingHashVersion !== 1) {
					return {
						ok: false,
						failure: commandFailure(
							"invalid_request",
							"The Command binding hash version is unsupported.",
						),
					};
				}
				return { ok: true, grantUse: { kind: "automatic" } };
			}
			if (request.policy.kind === "approval") {
				return {
					ok: false,
					failure: commandFailure(
						"approval_required",
						"A validated approval is required for this Command.",
					),
				};
			}
			return {
				ok: false,
				failure: commandFailure(
					"confirmation_required",
					"A fresh validated confirmation is required for this Command.",
				),
			};
		},
		async settle() {},
		async markAmbiguous() {},
	};
}

/**
 * In-memory adapter used by conformance tests. Its claim is installed before
 * execution begins, so identical concurrent requests share one execution.
 */
export function createInMemoryCommandPersistence(options?: {
	grants?: CommandGrantAdapter<MemoryCommandTransaction> | undefined;
}): CommandPersistence<MemoryCommandTransaction> {
	let state = new Map<string, string>();
	const executions = new Map<string, PersistedCommandExecution>();
	const claims = new Map<
		string,
		{
			inputDigest: string;
			completion: Promise<
				| { kind: "denied"; failure: CommandFailure }
				| { kind: "execution"; execution: PersistedCommandExecution }
			>;
		}
	>();
	const grants = options?.grants ?? defaultCommandGrantAdapter();
	let transactionTail = Promise.resolve();

	function transactionFor(transactionState: Map<string, string>) {
		return {
			get: (key: string) => transactionState.get(key) ?? null,
			set: (key: string, value: string) => {
				transactionState.set(key, value);
			},
			delete: (key: string) => {
				transactionState.delete(key);
			},
		} satisfies MemoryCommandTransaction;
	}

	return {
		async runOnce(args) {
			const existing = claims.get(args.scope);
			if (existing) {
				if (
					existing.inputDigest !== args.inputDigest &&
					existing.inputDigest !== args.legacyInputDigest
				) {
					return { kind: "conflict" };
				}
				const completed = await existing.completion;
				if (completed.kind === "denied") return completed;
				return {
					kind: "execution",
					replayed: true,
					execution: cloneExecution(completed.execution),
				};
			}

			let resolveCompletion:
				| ((
						result:
							| { kind: "denied"; failure: CommandFailure }
							| { kind: "execution"; execution: PersistedCommandExecution },
				  ) => void)
				| undefined;
			const completion = new Promise<
				| { kind: "denied"; failure: CommandFailure }
				| { kind: "execution"; execution: PersistedCommandExecution }
			>((resolve) => {
				resolveCompletion = resolve;
			});
			claims.set(args.scope, {
				inputDigest: args.inputDigest,
				completion,
			});
			const predecessor = transactionTail;
			let releaseTransaction: (() => void) | undefined;
			transactionTail = new Promise<void>((resolve) => {
				releaseTransaction = resolve;
			});
			await predecessor;

			try {
				const admissionState = new Map(state);
				const admissionTransaction = transactionFor(admissionState);
				const facts = await args.grant.resolveFacts(admissionTransaction);
				const admissionGrant = {
					...args.grant,
					resolveFacts: () => facts,
				};
				const admission = await grants.admit(
					admissionTransaction,
					admissionGrant,
				);
				if (!admission.ok) {
					await grants.recordDenied?.(
						admissionTransaction,
						admissionGrant,
						admission.failure,
					);
					state = admissionState;
					const denied = {
						kind: "denied" as const,
						failure: admission.failure,
					};
					resolveCompletion?.(denied);
					claims.delete(args.scope);
					return denied;
				}

				const admittedExecution = executionWithGrant(
					args.initialExecution,
					admission.grantUse,
					facts.bindingHashVersion,
					facts.bindingHash,
				);
				executions.set(
					admittedExecution.executionId,
					cloneExecution(admittedExecution),
				);
				// The claim, normalized GrantUse, and any consumption/reservation become
				// visible atomically before the handler runs.
				state = admissionState;
				const executionState = new Map(admissionState);
				const executionTransaction = transactionFor(executionState);
				const revalidation = grants.revalidate
					? await grants.revalidate(
							executionTransaction,
							args.grant,
							admission.grantUse,
						)
					: ({ ok: true, grantUse: admission.grantUse } as const);
				const completed = revalidation.ok
					? await args.run(executionTransaction, admittedExecution)
					: args.onGrantDenied?.(revalidation.failure, admittedExecution);
				if (!completed) {
					throw new Error("A revalidated grant denial requires a completion.");
				}
				if (!revalidation.ok) {
					await grants.recordDenied?.(
						executionTransaction,
						args.grant,
						revalidation.failure,
					);
				}
				const settlementState = completed.commitTransaction
					? executionState
					: new Map(admissionState);
				await grants.settle(
					transactionFor(settlementState),
					admittedExecution.executionId,
					completed.commitTransaction ? "succeeded" : "definite_failure",
				);
				state = settlementState;
				const stored = cloneExecution(completed.execution);
				executions.set(stored.executionId, stored);
				resolveCompletion?.({
					kind: "execution",
					execution: cloneExecution(stored),
				});
				return {
					kind: "execution",
					replayed: false,
					execution: cloneExecution(stored),
				};
			} catch (error) {
				const ambiguousState = new Map(state);
				await grants.markAmbiguous(
					transactionFor(ambiguousState),
					args.initialExecution.executionId,
				);
				state = ambiguousState;
				const running = executions.get(args.initialExecution.executionId);
				if (running) {
					resolveCompletion?.({
						kind: "execution",
						execution: cloneExecution(running),
					});
				} else {
					claims.delete(args.scope);
				}
				throw error;
			} finally {
				releaseTransaction?.();
			}
		},

		async get(executionId) {
			const execution = executions.get(executionId);
			return execution ? cloneExecution(execution) : undefined;
		},
	};
}

const AUTOMATIC_SENSITIVE_KEY =
	/(?:api[_-]?key|authorization|cookie|credential|password|secret|token)/i;

function isAutomaticallySensitive(key: string): boolean {
	return AUTOMATIC_SENSITIVE_KEY.test(key);
}

function redactInput(
	value: JsonValue,
	explicitPaths: ReadonlySet<string>,
	path: readonly string[] = [],
): JsonValue {
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			redactInput(item, explicitPaths, [...path, String(index)]),
		);
	}
	if (value === null || typeof value !== "object") {
		return value;
	}

	const redacted: Record<string, JsonValue> = {};
	for (const [key, item] of Object.entries(value)) {
		const itemPath = [...path, key];
		redacted[key] =
			isAutomaticallySensitive(key) || explicitPaths.has(itemPath.join("."))
				? "[REDACTED]"
				: redactInput(item, explicitPaths, itemPath);
	}
	return redacted;
}

function canonicalize(value: JsonValue): JsonValue {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value === null || typeof value !== "object") {
		return value;
	}
	const canonical: Record<string, JsonValue> = {};
	const entries = Object.entries(value).sort(([left], [right]) =>
		left < right ? -1 : left > right ? 1 : 0,
	);
	for (const [key, item] of entries) {
		canonical[key] = canonicalize(item);
	}
	return canonical;
}

function canonicalString(value: JsonValue): string {
	return JSON.stringify(canonicalize(value));
}

function keyedDigest(
	key: string,
	domain: string,
	version: number,
	value: JsonValue,
): string {
	return createHmac("sha256", key)
		.update(`${domain}\0v${version}\0`)
		.update(canonicalString(value))
		.digest("hex");
}

/** Stable, secret-keyed digest of validated input; grant references are excluded. */
export function computeCommandInputDigest(
	digestKey: string,
	content: {
		plane: AuthoritativePlane;
		command: CommandReference;
		target: TargetReference;
		input: JsonValue;
	},
): string {
	if (new TextEncoder().encode(digestKey).byteLength < 32) {
		throw new Error("Command digest key must be at least 32 bytes.");
	}
	return keyedDigest(digestKey, "86d.command.input", 2, content);
}

function commandFailure(
	code: CommandFailure["code"],
	message: string,
	retryable = false,
): CommandFailure {
	return { code, message, retryable };
}

function hasMismatchedGrantReference(
	actionLevel: ActionLevel,
	request: Pick<CommandRequest, "approvalReference" | "confirmationReference">,
): boolean {
	if (actionLevel === "automatic") {
		return Boolean(request.approvalReference || request.confirmationReference);
	}
	if (actionLevel === "approve") {
		return request.confirmationReference !== undefined;
	}
	return request.approvalReference !== undefined;
}

function redactCommandFailure(failure: CommandFailure): CommandFailure {
	if (failure.details === undefined) return failure;
	return {
		...failure,
		details: redactInput(failure.details, new Set()),
	};
}

function definitionKey(command: CommandReference): string {
	return `${command.name}@${command.version}`;
}

function isCommandPrincipal(value: unknown): value is CommandPrincipal {
	if (!value || typeof value !== "object") return false;
	if (
		!("type" in value) ||
		(value.type !== "session" &&
			value.type !== "workload" &&
			value.type !== "system") ||
		!("credentialId" in value) ||
		typeof value.credentialId !== "string" ||
		value.credentialId.length === 0
	) {
		return false;
	}
	return (
		value.type !== "session" ||
		("sessionId" in value &&
			typeof value.sessionId === "string" &&
			value.sessionId.length > 0)
	);
}

function makeAuditEvent(args: {
	id: string;
	plane: AuthoritativePlane;
	type: "command.started" | "command.succeeded" | "command.failed";
	actor: ActorReference;
	authority: AuthoritySnapshot;
	target: TargetReference;
	command: CommandReference;
	occurredAt: string;
	data: JsonValue;
}): AuditEvent {
	return {
		id: args.id,
		version: 1,
		plane: args.plane,
		type: args.type,
		actor: args.actor,
		authority: args.authority,
		target: args.target,
		command: args.command,
		occurredAt: args.occurredAt,
		data: args.data,
	};
}

function receiptFromExecution(
	execution: PersistedCommandExecution,
	replayed: boolean,
): CommandExecutionResponse {
	const base = {
		executionId: execution.executionId,
		command: execution.command,
		target: execution.target,
		idempotencyKey: execution.idempotencyKey,
		actionLevel: execution.actionLevel,
		replayed,
		startedAt: execution.startedAt,
	};
	if (
		execution.status === "succeeded" &&
		execution.completedAt &&
		execution.result !== undefined
	) {
		return {
			ok: true,
			receipt: {
				...base,
				status: "succeeded",
				completedAt: execution.completedAt,
				result: execution.result,
			},
		};
	}
	if (
		execution.status === "failed" &&
		execution.completedAt &&
		execution.failure
	) {
		return {
			ok: false,
			failure: execution.failure,
			receipt: {
				...base,
				status: "failed",
				completedAt: execution.completedAt,
				failure: execution.failure,
			},
		};
	}
	return {
		ok: false,
		failure: commandFailure(
			"temporarily_unavailable",
			"Command execution is still running.",
			true,
		),
		receipt: { ...base, status: "running" },
	};
}

export type GetCommandExecutionResponse =
	| { ok: true; execution: PersistedCommandExecution }
	| { ok: false; failure: CommandFailure };

export interface CommandExecutor {
	execute(
		request: unknown,
		context: CommandExecutionContext,
	): Promise<CommandExecutionResponse>;
	get(
		executionId: string,
		context: CommandExecutionContext,
	): Promise<GetCommandExecutionResponse>;
}

export function createCommandExecutor<TTransaction>(options: {
	plane: AuthoritativePlane;
	definitions: readonly DefinedCommand<TTransaction>[];
	authority: CommandAuthority;
	persistence: CommandPersistence<TTransaction>;
	digestKey: string;
	clock?: (() => Date) | undefined;
	createId?: ((kind: "execution" | "audit") => string) | undefined;
}): CommandExecutor {
	if (
		typeof options.digestKey !== "string" ||
		new TextEncoder().encode(options.digestKey).byteLength < 32
	) {
		throw new Error("Command digest key must be at least 32 bytes.");
	}
	const clock = options.clock ?? (() => new Date());
	const createId = options.createId ?? (() => randomUUID());
	const definitions = new Map<string, DefinedCommand<TTransaction>>();
	for (const definition of options.definitions) {
		const parsed = commandReferenceSchema.parse(definition.command);
		const key = definitionKey(parsed);
		if (definitions.has(key)) {
			throw new Error(`Duplicate Command definition: ${key}`);
		}
		if (definition.ownerPlane !== options.plane) {
			throw new Error(`Command ${key} belongs to a different plane.`);
		}
		definitions.set(key, definition);
	}

	async function execute(
		rawRequest: unknown,
		context: CommandExecutionContext,
	): Promise<CommandExecutionResponse> {
		const parsedRequest = commandRequestSchema.safeParse(rawRequest);
		if (!parsedRequest.success) {
			return {
				ok: false,
				failure: commandFailure(
					"invalid_request",
					"Command request is invalid.",
				),
			};
		}
		if (!isCommandPrincipal(context?.principal)) {
			return {
				ok: false,
				failure: commandFailure(
					"unauthenticated",
					"A server-authenticated principal is required.",
				),
			};
		}

		const request = parsedRequest.data;
		const definition = definitions.get(definitionKey(request.command));
		if (!definition) {
			return {
				ok: false,
				failure: commandFailure(
					"unknown_command",
					"Command is not registered.",
				),
			};
		}
		if (request.target.type !== definition.targetType) {
			return {
				ok: false,
				failure: commandFailure(
					"invalid_request",
					"Command target type is invalid.",
				),
			};
		}

		const parsedInput = definition.parseInput(request.input);
		if (!parsedInput.success) {
			return {
				ok: false,
				failure: commandFailure("invalid_input", "Command input is invalid."),
			};
		}
		if (hasMismatchedGrantReference(definition.actionLevel, request)) {
			return {
				ok: false,
				failure: commandFailure(
					"invalid_request",
					"The grant reference does not match the Command action level.",
				),
			};
		}

		const authorization = await options.authority.authorize({
			principal: context.principal,
			request,
			definition,
		});
		if (!authorization.ok) {
			return { ok: false, failure: authorization.failure };
		}
		const actor = actorReferenceSchema.safeParse(authorization.actor);
		const authority = authoritySnapshotSchema.safeParse(
			authorization.authority,
		);
		const target = targetReferenceSchema.safeParse(authorization.target);
		if (
			!actor.success ||
			!authority.success ||
			!target.success ||
			target.data.type !== definition.targetType
		) {
			return {
				ok: false,
				failure: commandFailure(
					"forbidden",
					"Command authority could not resolve the target.",
				),
			};
		}

		const legacyDigestMaterial: JsonValue = {
			input: parsedInput.data,
			approvalReference: request.approvalReference ?? null,
			confirmationReference: request.confirmationReference ?? null,
		};
		const inputDigest = computeCommandInputDigest(options.digestKey, {
			plane: options.plane,
			command: request.command,
			target: target.data,
			input: parsedInput.data,
		});
		const legacyInputDigest = createHmac("sha256", options.digestKey)
			.update(canonicalString(legacyDigestMaterial))
			.digest("hex");

		const redactedInput = redactInput(
			parsedInput.data,
			new Set(definition.sensitiveInputPaths ?? []),
		);
		const scope = canonicalString({
			plane: options.plane,
			actor: actor.data,
			target: target.data,
			command: request.command,
			idempotencyKey: request.idempotencyKey,
		});

		const startedAt = clock().toISOString();
		const executionId = createId("execution");
		const startedAudit = makeAuditEvent({
			id: createId("audit"),
			plane: options.plane,
			type: "command.started",
			actor: actor.data,
			authority: authority.data,
			target: target.data,
			command: request.command,
			occurredAt: startedAt,
			data: { executionId, inputDigest },
		});
		const initialExecution: CommandExecutionClaim = {
			executionId,
			plane: options.plane,
			command: request.command,
			target: target.data,
			actor: actor.data,
			authority: authority.data,
			idempotencyKey: request.idempotencyKey,
			actionLevel: definition.actionLevel,
			status: "running",
			requestDigestVersion: 2,
			inputDigest,
			redactedInput,
			startedAt,
			auditEvents: [startedAudit],
		};

		const grant: CommandGrantAdmissionRequest<TTransaction> = {
			executionId,
			principal: context.principal,
			plane: options.plane,
			command: request.command,
			inputDigest,
			actor: actor.data,
			authority: authority.data,
			target: target.data,
			policy: definition.admissionPolicy,
			...(request.approvalReference
				? { approvalReference: request.approvalReference }
				: {}),
			...(request.confirmationReference
				? { confirmationReference: request.confirmationReference }
				: {}),
			async resolveFacts(transaction) {
				const facts = await definition.resolveGrantFacts({
					actor: actor.data,
					authority: authority.data,
					target: target.data,
					input: parsedInput.data,
					inputDigest,
					transaction,
				});
				return validateCommandGrantFacts(facts, {
					plane: options.plane,
					command: request.command,
					target: target.data,
					inputDigest,
				});
			},
		};
		const runResult = await options.persistence.runOnce({
			scope,
			inputDigest,
			legacyInputDigest,
			initialExecution,
			grant,
			onGrantDenied(failure, admittedExecution) {
				const finishedAt = clock().toISOString();
				const redactedFailure = redactCommandFailure(failure);
				return {
					commitTransaction: false,
					execution: {
						...admittedExecution,
						status: "failed",
						completedAt: finishedAt,
						failure: redactedFailure,
						auditEvents: [
							startedAudit,
							makeAuditEvent({
								id: createId("audit"),
								plane: options.plane,
								type: "command.failed",
								actor: actor.data,
								authority: authority.data,
								target: target.data,
								command: request.command,
								occurredAt: finishedAt,
								data: { executionId, code: redactedFailure.code },
							}),
						],
					},
				};
			},
			run: async (transaction, admittedExecution) => {
				// A thrown error means the external outcome is unknown. Let persistence
				// mark the grant ambiguous instead of releasing reserved authority.
				const outcome = await definition.execute({
					actor: actor.data,
					authority: authority.data,
					target: target.data,
					input: parsedInput.data,
					transaction,
					invocation: {
						executionId: admittedExecution.executionId,
						idempotencyKey: admittedExecution.idempotencyKey,
					},
				});
				if (outcome.ok) {
					const redactedResult = redactInput(
						outcome.result,
						new Set(definition.sensitiveResultPaths),
					);
					const finishedAt = clock().toISOString();
					const succeededAudit = makeAuditEvent({
						id: createId("audit"),
						plane: options.plane,
						type: "command.succeeded",
						actor: actor.data,
						authority: authority.data,
						target: target.data,
						command: request.command,
						occurredAt: finishedAt,
						data: { executionId },
					});
					return {
						commitTransaction: true,
						execution: {
							...admittedExecution,
							status: "succeeded",
							completedAt: finishedAt,
							result: redactedResult,
							auditEvents: [startedAudit, succeededAudit],
						},
					};
				}

				const finishedAt = clock().toISOString();
				const failure = redactCommandFailure(outcome.failure);
				const failedAudit = makeAuditEvent({
					id: createId("audit"),
					plane: options.plane,
					type: "command.failed",
					actor: actor.data,
					authority: authority.data,
					target: target.data,
					command: request.command,
					occurredAt: finishedAt,
					data: { executionId, code: failure.code },
				});
				return {
					commitTransaction: false,
					execution: {
						...admittedExecution,
						status: "failed",
						completedAt: finishedAt,
						failure,
						auditEvents: [startedAudit, failedAudit],
					},
				};
			},
		});

		if (runResult.kind === "conflict") {
			return {
				ok: false,
				failure: commandFailure(
					"idempotency_conflict",
					"The idempotency key was already used with different input.",
				),
			};
		}
		if (runResult.kind === "denied") {
			return { ok: false, failure: runResult.failure };
		}
		return receiptFromExecution(runResult.execution, runResult.replayed);
	}

	async function get(
		executionId: string,
		context: CommandExecutionContext,
	): Promise<GetCommandExecutionResponse> {
		if (!isCommandPrincipal(context?.principal)) {
			return {
				ok: false,
				failure: commandFailure(
					"unauthenticated",
					"A server-authenticated principal is required.",
				),
			};
		}
		const execution = await options.persistence.get(executionId);
		if (!execution) {
			return {
				ok: false,
				failure: commandFailure(
					"target_not_found",
					"Command execution was not found.",
				),
			};
		}
		const allowed = await options.authority.canRead({
			principal: context.principal,
			execution,
		});
		if (!allowed) {
			return {
				ok: false,
				failure: commandFailure(
					"forbidden",
					"Command execution is unavailable.",
				),
			};
		}
		return { ok: true, execution };
	}

	return { execute, get };
}
