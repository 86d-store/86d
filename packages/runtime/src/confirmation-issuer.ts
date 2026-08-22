import { randomBytes, randomUUID } from "node:crypto";
import {
	type ActorReference,
	type AuthoritySnapshot,
	actorReferenceSchema,
	authoritySnapshotSchema,
	commandReferenceSchema,
	confirmationSchema,
	targetReferenceSchema,
} from "@86d-app/contracts/command";
import { z } from "zod";
import type { CommandPrincipal } from "./command";
import {
	type CommandGrantFacts,
	commandGrantFactsSchema,
	computeConfirmationNonceDigest,
	createConfirmationProof,
	validateCommandGrantFacts,
} from "./grants";

export interface DrizzleConfirmationIssueTransaction {
	confirmation: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
	};
	auditEvent: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
	};
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface DrizzleConfirmationIssueClient<
	TTransaction extends DrizzleConfirmationIssueTransaction,
> {
	$transaction<T>(run: (transaction: TTransaction) => Promise<T>): Promise<T>;
}

const sessionPrincipalSchema = z
	.object({
		type: z.literal("session"),
		credentialId: z.string().min(1).max(255),
		sessionId: z.string().min(1).max(255),
	})
	.strict();

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const issueRequestSchema = z
	.object({
		principal: sessionPrincipalSchema,
		target: targetReferenceSchema,
		command: commandReferenceSchema,
		inputDigest: digestSchema,
		facts: commandGrantFactsSchema,
	})
	.strict();

const authorizationSchema = z
	.object({
		actor: actorReferenceSchema.refine((actor) => actor.type === "account", {
			message: "Confirmation requires a human Account actor.",
		}),
		authority: authoritySnapshotSchema,
	})
	.strict();

const challengeSchema = z
	.object({
		reference: z.string().min(34).max(255),
		command: commandReferenceSchema,
		target: targetReferenceSchema,
		disclosure: z.string().min(1).max(2_000),
		amount: z
			.string()
			.regex(/^(?:0|[1-9]\d{0,64})$/)
			.optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
		expiresAt: z.string().datetime(),
	})
	.strict()
	.superRefine((challenge, context) => {
		if (
			(challenge.amount === undefined) !==
			(challenge.currency === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Confirmation amount and currency must be supplied together.",
			});
		}
	});

export interface StoreConfirmationIssueRequest {
	principal: CommandPrincipal;
	target: z.input<typeof targetReferenceSchema>;
	command: z.input<typeof commandReferenceSchema>;
	inputDigest: string;
	facts: CommandGrantFacts;
}

export type StoreConfirmationChallenge = z.infer<typeof challengeSchema>;

export interface StoreConfirmationIssuer {
	issue(
		request: StoreConfirmationIssueRequest,
	): Promise<StoreConfirmationChallenge>;
}

export interface DrizzleStoreConfirmationIssuerOptions<
	TTransaction extends DrizzleConfirmationIssueTransaction,
> {
	nonceDigestKey: string;
	ttlMs?: number | undefined;
	createNonce?: (() => string) | undefined;
	createId?: ((kind: "audit_event" | "confirmation") => string) | undefined;
	/** Resolves current plane-local authority for the authenticated session. */
	authorize(
		transaction: TTransaction,
		request: {
			principal: Extract<CommandPrincipal, { type: "session" }>;
			target: z.infer<typeof targetReferenceSchema>;
			command: z.infer<typeof commandReferenceSchema>;
		},
	): Promise<{ actor: ActorReference; authority: AuthoritySnapshot } | null>;
	resolveTargetScope(
		transaction: TTransaction,
		target: z.infer<typeof targetReferenceSchema>,
	): Promise<{ businessId: string; storeId?: string | undefined } | null>;
}

export const STORE_CONFIRMATION_TTL_MS = 5 * 60 * 1_000;

function databaseDate(value: unknown): Date {
	const parsed =
		value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
	if (!Number.isFinite(parsed.getTime())) {
		throw new Error("The database did not return a valid confirmation time.");
	}
	return parsed;
}

/**
 * Issues a Store Runtime challenge in one transaction. The nonce leaves the
 * module once and only its keyed digest is persisted.
 */
export function createDrizzleStoreConfirmationIssuer<
	TTransaction extends DrizzleConfirmationIssueTransaction,
>(
	client: DrizzleConfirmationIssueClient<TTransaction>,
	options: DrizzleStoreConfirmationIssuerOptions<TTransaction>,
): StoreConfirmationIssuer {
	if (new TextEncoder().encode(options.nonceDigestKey).byteLength < 32) {
		throw new Error("Confirmation nonce digest key must be at least 32 bytes.");
	}
	const ttlMs = options.ttlMs ?? STORE_CONFIRMATION_TTL_MS;
	if (
		!Number.isSafeInteger(ttlMs) ||
		ttlMs < 1_000 ||
		ttlMs > 15 * 60 * 1_000
	) {
		throw new Error("Confirmation challenge TTL must be 1 to 15 minutes.");
	}
	const createNonce =
		options.createNonce ?? (() => randomBytes(32).toString("base64url"));
	const createId =
		options.createId ??
		((kind: "audit_event" | "confirmation") => `${kind}-${randomUUID()}`);

	return {
		issue: (rawRequest) =>
			client.$transaction(async (transaction) => {
				const request = issueRequestSchema.parse(rawRequest);
				const authorization = authorizationSchema.safeParse(
					await options.authorize(transaction, {
						principal: request.principal,
						target: request.target,
						command: request.command,
					}),
				);
				if (!authorization.success) {
					throw new Error("The session cannot authorize this confirmation.");
				}
				const scope = await options.resolveTargetScope(
					transaction,
					request.target,
				);
				const authority = authorization.data.authority;
				const scopeMatches =
					scope !== null &&
					authority.businessId === scope.businessId &&
					(authority.storeId === undefined ||
						authority.storeId === scope.storeId) &&
					(request.target.type !== "business" ||
						(request.target.id === scope.businessId &&
							scope.storeId === undefined &&
							authority.storeId === undefined)) &&
					(request.target.type !== "store" ||
						request.target.id === scope.storeId) &&
					(request.facts.businessId === undefined ||
						request.facts.businessId === scope.businessId) &&
					(request.facts.storeId === undefined ||
						request.facts.storeId === scope.storeId);
				if (!scopeMatches) {
					throw new Error(
						"The session cannot authorize this confirmation scope.",
					);
				}
				const facts = validateCommandGrantFacts(request.facts, {
					plane: "store_runtime",
					command: request.command,
					target: request.target,
					inputDigest: request.inputDigest,
				});
				const timeRows = await transaction.$queryRawUnsafe<
					Array<{ now: Date | string }>
				>('SELECT clock_timestamp() AS "now"');
				const createdAt = databaseDate(timeRows[0]?.now);
				const expiresAt = new Date(createdAt.getTime() + ttlMs);
				const confirmationId = createId("confirmation");
				const nonce = createNonce();
				const nonceDigest = computeConfirmationNonceDigest(
					options.nonceDigestKey,
					nonce,
				);
				const reference = createConfirmationProof(confirmationId, nonce);
				if (reference.length > 255) {
					throw new Error("Confirmation proof exceeds the transport limit.");
				}
				const { actor } = authorization.data;
				const confirmation = confirmationSchema.parse({
					id: confirmationId,
					actor,
					sessionId: request.principal.sessionId,
					target: request.target,
					command: request.command,
					bindingHashVersion: facts.bindingHashVersion,
					bindingHash: facts.bindingHash,
					nonceDigest,
					disclosure: facts.disclosure,
					...(facts.amount === undefined
						? {}
						: {
								amount: facts.amount,
								currency: facts.currency,
							}),
					createdAt: createdAt.toISOString(),
					expiresAt: expiresAt.toISOString(),
				});
				await transaction.confirmation.create({
					data: {
						id: confirmation.id,
						actorType: confirmation.actor.type,
						actorId: confirmation.actor.id,
						actor: confirmation.actor,
						sessionId: confirmation.sessionId,
						targetType: confirmation.target.type,
						targetId: confirmation.target.id,
						target: confirmation.target,
						commandName: confirmation.command.name,
						commandVersion: confirmation.command.version,
						bindingHashVersion: confirmation.bindingHashVersion,
						bindingHash: confirmation.bindingHash,
						nonceDigest: confirmation.nonceDigest,
						disclosure: confirmation.disclosure,
						...(confirmation.amount === undefined
							? {}
							: {
									amount: confirmation.amount,
									currency: confirmation.currency,
								}),
						createdAt,
						expiresAt,
					},
				});
				await transaction.auditEvent.create({
					data: {
						id: createId("audit_event"),
						version: 1,
						plane: "store_runtime",
						eventType: "confirmation.created",
						actorType: actor.type,
						actorId: actor.id,
						actor,
						authorityType: authority.type,
						authorityId: authority.id,
						authority,
						targetType: request.target.type,
						targetId: request.target.id,
						target: request.target,
						commandName: request.command.name,
						commandVersion: request.command.version,
						occurredAt: createdAt,
						data: {
							confirmationId,
							bindingHashVersion: facts.bindingHashVersion,
							bindingHash: facts.bindingHash,
							disclosure: facts.disclosure,
							expiresAt: expiresAt.toISOString(),
							...(facts.amount === undefined
								? {}
								: {
										amount: facts.amount,
										currency: facts.currency,
									}),
						},
					},
				});
				return challengeSchema.parse({
					reference,
					command: request.command,
					target: request.target,
					disclosure: facts.disclosure,
					expiresAt: expiresAt.toISOString(),
					...(facts.amount === undefined
						? {}
						: {
								amount: facts.amount,
								currency: facts.currency,
							}),
				});
			}),
	};
}
