import type {
	ActorReference,
	AuthoritySnapshot,
	CommandReference,
	TargetReference,
} from "@86d-app/contracts/command";
import { computeCommandBindingHash } from "@86d-app/contracts/command";
import type { ModuleDataTransaction } from "@86d-app/core/durable-events";
import type { Module } from "@86d-app/core/types/module";
import {
	applyCatalogRevisionOperation,
	type CatalogRevisionOperationFailureCode,
	type CatalogRevisionOperationResult,
	catalogDraftCommandInputSchema,
	catalogRevisionOperationDecisionSchema,
	catalogTransitionCommandInputSchema,
} from "@86d-app/products/catalog-revisions";
import {
	type CommandAuthority,
	type CommandPersistence,
	type CommandPrincipal,
	createCommandExecutor,
	defineCommand,
} from "@86d-app/runtime/command";
import { createDrizzleCommandPersistence } from "@86d-app/runtime/command-drizzle";
import { CompiledModuleDataService } from "@86d-app/runtime/compiled-module-data-service";
import {
	compiledForModule,
	compileInstalledModules,
} from "@86d-app/runtime/compiled-schema-boot";
import { createDrizzlePersistenceClient } from "@86d-app/runtime/drizzle-persistence-client";
import { getPool } from "db";
import { drizzle } from "drizzle-orm/node-postgres";
import env from "env";
import { modules } from "../generated/api";
import { ensureBooted } from "./api-registry";

export const catalogDraftCommandReference = {
	name: "products.catalog.draft",
	version: 1,
} satisfies CommandReference;

export const catalogReviewCommandReference = {
	name: "products.catalog.review",
	version: 1,
} satisfies CommandReference;

export const catalogPublishCommandReference = {
	name: "products.catalog.publish",
	version: 1,
} satisfies CommandReference;

const catalogCommandNames = new Set([
	catalogDraftCommandReference.name,
	catalogReviewCommandReference.name,
	catalogPublishCommandReference.name,
]);

export interface CatalogCommandExecutorOptions {
	authority: CommandAuthority;
	digestKey: string;
	clock?: (() => Date) | undefined;
	createId?: ((kind: "execution" | "audit") => string) | undefined;
}

export interface StoreAdminCatalogAuthorityOptions {
	storeId: string;
	userId: string;
	sessionId: string;
	role?: string | null | undefined;
}

export interface ComposeCatalogCommandExecutorOptions<TTransaction>
	extends CatalogCommandExecutorOptions {
	storeId: string;
	persistence: CommandPersistence<TTransaction>;
	runOnOwnerTransaction: (
		transaction: TTransaction,
		operation: (
			owner: ModuleDataTransaction,
		) => Promise<CatalogRevisionOperationResult>,
	) => Promise<CatalogRevisionOperationResult>;
}

/**
 * Bind one verified local Store Admin session to the single-tenant Store.
 * Browser input never selects the target, actor, authority, or permissions.
 */
export function createStoreAdminCatalogAuthority(
	options: StoreAdminCatalogAuthorityOptions,
) {
	const actor = {
		type: "account",
		id: options.userId,
	} satisfies ActorReference;
	const authority = {
		id: options.sessionId,
		type: "store_membership",
		...(options.role ? { role: options.role } : {}),
		permissions: ["catalog:write"],
		storeId: options.storeId,
	} satisfies AuthoritySnapshot;

	function isBoundPrincipal(principal: CommandPrincipal) {
		return (
			principal.type === "session" &&
			principal.credentialId === options.sessionId &&
			principal.sessionId === options.sessionId
		);
	}

	return {
		async authorize({ principal, request, definition }) {
			if (
				!isBoundPrincipal(principal) ||
				definition.ownerPlane !== "store_runtime" ||
				!catalogCommandNames.has(definition.command.name) ||
				request.target.type !== "store" ||
				request.target.id !== options.storeId
			) {
				return {
					ok: false,
					failure: {
						code: "forbidden",
						message: "The Store Admin session cannot execute this Command.",
						retryable: false,
					},
				};
			}

			return {
				ok: true,
				actor,
				authority,
				target: request.target,
			};
		},
		async canRead({ principal, execution }) {
			return (
				isBoundPrincipal(principal) &&
				execution.target.type === "store" &&
				execution.target.id === options.storeId &&
				execution.actor.type === "account" &&
				execution.actor.id === options.userId
			);
		},
	} satisfies CommandAuthority;
}

function commandFailureFor(
	code: CatalogRevisionOperationFailureCode,
	message: string,
	retryable: boolean,
) {
	if (code === "revision_not_found" || code === "base_revision_not_found") {
		return {
			code: "target_not_found" as const,
			message,
			retryable,
		};
	}
	if (code === "locking_unavailable") {
		return {
			code: "temporarily_unavailable" as const,
			message,
			retryable,
		};
	}
	if (code === "idempotency_conflict") {
		return {
			code: "idempotency_conflict" as const,
			message,
			retryable,
		};
	}
	if (code === "invalid_request") {
		return {
			code: "invalid_input" as const,
			message,
			retryable,
		};
	}
	return {
		code: "execution_failed" as const,
		message,
		retryable,
	};
}

function authorizedCatalogWrite(options: {
	storeId: string;
	command: CommandReference;
	disclosure: string;
}) {
	return {
		ownerPlane: "store_runtime" as const,
		targetType: "store" as const,
		actionLevel: "automatic" as const,
		resultSchema: catalogRevisionOperationDecisionSchema,
		resolveGrantFacts: ({
			input,
			inputDigest,
			target,
		}: {
			input: { revisionId: string };
			inputDigest: string;
			target: TargetReference;
		}) => {
			const disclosure = options.disclosure.replace(
				"{revisionId}",
				input.revisionId,
			);
			return {
				bindingHashVersion: 1 as const,
				disclosure,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: options.command,
					target,
					inputDigest,
					disclosure,
				}),
				storeId: options.storeId,
				baseRevisions: undefined,
			};
		},
	};
}

function catalogDraftCommand<TTransaction>(options: {
	storeId: string;
	clock: () => Date;
	runOnOwnerTransaction: ComposeCatalogCommandExecutorOptions<TTransaction>["runOnOwnerTransaction"];
}) {
	const command = catalogDraftCommandReference;
	return defineCommand<TTransaction>()({
		command,
		...authorizedCatalogWrite({
			storeId: options.storeId,
			command,
			disclosure: "Create Catalog revision {revisionId}.",
		}),
		inputSchema: catalogDraftCommandInputSchema,
		execute: async ({
			actor,
			authority,
			input,
			invocation,
			target,
			transaction,
		}) => {
			if (
				target.id !== options.storeId ||
				authority.storeId !== options.storeId
			) {
				return {
					ok: false,
					failure: {
						code: "forbidden",
						message: "Catalog can only be written in the authorized Store.",
						retryable: false,
					},
				};
			}
			if (input.operationId !== invocation.idempotencyKey) {
				return {
					ok: false,
					failure: {
						code: "invalid_input",
						message:
							"Catalog Command operation identity must match the Command idempotency key.",
						retryable: false,
					},
				};
			}

			const outcome = await options.runOnOwnerTransaction(
				transaction,
				(owner) =>
					applyCatalogRevisionOperation(
						owner,
						{
							action: "create_draft",
							operationId: input.operationId,
							revisionId: input.revisionId,
							...(input.baseRevisionId === undefined
								? {}
								: { baseRevisionId: input.baseRevisionId }),
							content: input.content,
						},
						{
							actor,
							authority,
							occurredAt: options.clock(),
							commandExecutionId: invocation.executionId,
						},
					),
			);
			if (!outcome.ok) {
				return {
					ok: false,
					failure: commandFailureFor(
						outcome.failure.code,
						outcome.failure.message,
						outcome.failure.retryable,
					),
				};
			}
			return { ok: true, result: outcome.decision };
		},
	});
}

function catalogTransitionCommand<TTransaction>(options: {
	command: CommandReference;
	action: "review" | "publish";
	storeId: string;
	clock: () => Date;
	runOnOwnerTransaction: ComposeCatalogCommandExecutorOptions<TTransaction>["runOnOwnerTransaction"];
}) {
	return defineCommand<TTransaction>()({
		command: options.command,
		...authorizedCatalogWrite({
			storeId: options.storeId,
			command: options.command,
			disclosure:
				options.action === "review"
					? "Review Catalog revision {revisionId}."
					: "Publish Catalog revision {revisionId}.",
		}),
		inputSchema: catalogTransitionCommandInputSchema,
		execute: async ({
			actor,
			authority,
			input,
			invocation,
			target,
			transaction,
		}) => {
			if (
				target.id !== options.storeId ||
				authority.storeId !== options.storeId
			) {
				return {
					ok: false,
					failure: {
						code: "forbidden",
						message: "Catalog can only be written in the authorized Store.",
						retryable: false,
					},
				};
			}
			if (input.operationId !== invocation.idempotencyKey) {
				return {
					ok: false,
					failure: {
						code: "invalid_input",
						message:
							"Catalog Command operation identity must match the Command idempotency key.",
						retryable: false,
					},
				};
			}

			const outcome = await options.runOnOwnerTransaction(
				transaction,
				(owner) =>
					applyCatalogRevisionOperation(
						owner,
						{
							action: options.action,
							operationId: input.operationId,
							revisionId: input.revisionId,
							expectedContentDigest: input.expectedContentDigest,
						},
						{
							actor,
							authority,
							occurredAt: options.clock(),
							commandExecutionId: invocation.executionId,
						},
					),
			);
			if (!outcome.ok) {
				return {
					ok: false,
					failure: commandFailureFor(
						outcome.failure.code,
						outcome.failure.message,
						outcome.failure.retryable,
					),
				};
			}
			return { ok: true, result: outcome.decision };
		},
	});
}

/**
 * Compose Catalog draft, review, and publish on the durable Command engine.
 * Command completion, audit, Catalog revision state, and the publication outbox
 * fact use the owner-local transaction supplied by persistence. Transport remains
 * a caller concern.
 */
export function composeCatalogCommandExecutor<TTransaction>(
	options: ComposeCatalogCommandExecutorOptions<TTransaction>,
) {
	const clock = options.clock ?? (() => new Date());
	return createCommandExecutor({
		plane: "store_runtime",
		definitions: [
			catalogDraftCommand({
				storeId: options.storeId,
				clock,
				runOnOwnerTransaction: options.runOnOwnerTransaction,
			}),
			catalogTransitionCommand({
				command: catalogReviewCommandReference,
				action: "review",
				storeId: options.storeId,
				clock,
				runOnOwnerTransaction: options.runOnOwnerTransaction,
			}),
			catalogTransitionCommand({
				command: catalogPublishCommandReference,
				action: "publish",
				storeId: options.storeId,
				clock,
				runOnOwnerTransaction: options.runOnOwnerTransaction,
			}),
		],
		authority: options.authority,
		persistence: options.persistence,
		digestKey: options.digestKey,
		clock,
		...(options.createId === undefined ? {} : { createId: options.createId }),
	});
}

/**
 * Compose the Catalog Commands on Drizzle persistence for the booted Store.
 * Command completion, Catalog revision rows, and `catalog.published@1` share
 * one database transaction. Transport remains a caller concern.
 */
export async function createCatalogCommandExecutor(
	options: CatalogCommandExecutorOptions,
) {
	const registry = await ensureBooted();
	const productsModuleDbId = registry.getModuleDbId("products");
	if (!productsModuleDbId) {
		throw new Error('Module "products" is not initialized.');
	}
	const storeId = env.STORE_ID;
	const pool = getPool();
	const persistenceClient = createDrizzlePersistenceClient(pool);
	const compiled = compileInstalledModules(modules as Module[]);
	return composeCatalogCommandExecutor({
		...options,
		storeId,
		persistence: createDrizzleCommandPersistence(persistenceClient, {}),
		runOnOwnerTransaction: async (transaction, operation) => {
			const client = (transaction as { _poolClient?: import("pg").PoolClient })
				._poolClient;
			if (!client) {
				throw new Error("Command transaction is missing a pool client.");
			}
			const txDb = drizzle(client);
			const data = new CompiledModuleDataService({
				db: txDb,
				storeId,
				moduleId: "products",
				moduleDbId: productsModuleDbId,
				compiled: compiledForModule(compiled, "products"),
			});
			return operation(data.currentTransaction());
		},
	});
}
