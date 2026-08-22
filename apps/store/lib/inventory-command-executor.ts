import type {
	ActorReference,
	AuthoritySnapshot,
	CommandReference,
} from "@86d-app/contracts/command";
import { computeCommandBindingHash } from "@86d-app/contracts/command";
import type { Module } from "@86d-app/core/types/module";
import {
	adjustInventoryStockFromCommand,
	inventoryStockAdjustInputSchema,
	inventoryStockAdjustOutcomeSchema,
} from "@86d-app/inventory/commands";
import {
	type CommandAuthority,
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
import {
	createDrizzlePersistenceClient,
	type PersistenceTransaction,
} from "@86d-app/runtime/drizzle-persistence-client";
import { getPool } from "db";
import { drizzle } from "drizzle-orm/node-postgres";
import env from "env";
import { modules } from "../generated/api";
import { ensureBooted } from "./api-registry";

export const inventoryStockAdjustCommandReference = {
	name: "inventory.stock.adjust",
	version: 1,
} satisfies CommandReference;

export interface InventoryCommandExecutorOptions {
	authority: CommandAuthority;
	digestKey: string;
	clock?: (() => Date) | undefined;
	createId?: ((kind: "execution" | "audit") => string) | undefined;
}

export interface StoreAdminInventoryAuthorityOptions {
	storeId: string;
	userId: string;
	sessionId: string;
	role?: string | null | undefined;
}

/**
 * Bind one verified local Store Admin session to the single-tenant Store.
 * Browser input never selects the target, actor, authority, or permissions.
 */
export function createStoreAdminInventoryAuthority(
	options: StoreAdminInventoryAuthorityOptions,
) {
	const actor = {
		type: "account",
		id: options.userId,
	} satisfies ActorReference;
	const authority = {
		id: options.sessionId,
		type: "store_membership",
		...(options.role ? { role: options.role } : {}),
		permissions: ["inventory:write"],
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
				definition.command.name !== "inventory.stock.adjust" ||
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

function inventoryStockAdjustCommand(options: {
	storeId: string;
	inventoryModuleDbId: string;
	clock: () => Date;
}) {
	return defineCommand<PersistenceTransaction>()({
		command: inventoryStockAdjustCommandReference,
		ownerPlane: "store_runtime",
		targetType: "store",
		actionLevel: "automatic",
		inputSchema: inventoryStockAdjustInputSchema,
		resultSchema: inventoryStockAdjustOutcomeSchema,
		resolveGrantFacts: ({ input, inputDigest, target }) => {
			const disclosure = `Adjust inventory for product ${input.productId} by ${input.delta} units.`;
			return {
				bindingHashVersion: 1,
				disclosure,
				bindingHash: computeCommandBindingHash({
					bindingHashVersion: 1,
					plane: "store_runtime",
					command: inventoryStockAdjustCommandReference,
					target,
					inputDigest,
					disclosure,
				}),
				storeId: options.storeId,
				baseRevisions: undefined,
			};
		},
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
						message: "Inventory can only be adjusted in the authorized Store.",
						retryable: false,
					},
				};
			}

			const client = transaction._poolClient;
			const txDb = drizzle(client);
			const compiled = compileInstalledModules(modules as Module[]);
			const data = new CompiledModuleDataService({
				db: txDb,
				storeId: options.storeId,
				moduleId: "inventory",
				moduleDbId: options.inventoryModuleDbId,
				compiled: compiledForModule(compiled, "inventory"),
			});
			const adjustment = await adjustInventoryStockFromCommand(
				data.currentTransaction(),
				input,
				{
					executionId: invocation.executionId,
					operationId: invocation.idempotencyKey,
					actor,
					authority,
					occurredAt: options.clock(),
				},
			);
			if (!adjustment.ok) {
				return {
					ok: false,
					failure: {
						code:
							adjustment.reason === "not_found"
								? "target_not_found"
								: "execution_failed",
						message:
							adjustment.reason === "not_found"
								? "The Inventory item was not found."
								: "The Inventory item is not in a valid state.",
						retryable: false,
					},
				};
			}
			return { ok: true, result: adjustment.outcome };
		},
	});
}

/**
 * Compose the first production Store mutation on the durable Command engine.
 * Command completion, audit, Inventory state, and its outbox fact use the same
 * database transaction. Transport remains a caller concern.
 */
export async function createInventoryCommandExecutor(
	options: InventoryCommandExecutorOptions,
) {
	const registry = await ensureBooted();
	const inventoryModuleDbId = registry.getModuleDbId("inventory");
	if (!inventoryModuleDbId) {
		throw new Error('Module "inventory" is not initialized.');
	}
	return composeInventoryCommandExecutor({
		...options,
		storeId: env.STORE_ID,
		inventoryModuleDbId,
	});
}

function composeInventoryCommandExecutor(
	options: InventoryCommandExecutorOptions & {
		storeId: string;
		inventoryModuleDbId: string;
	},
) {
	const clock = options.clock ?? (() => new Date());
	const persistenceClient = createDrizzlePersistenceClient(getPool());
	return createCommandExecutor({
		plane: "store_runtime",
		definitions: [
			inventoryStockAdjustCommand({
				storeId: options.storeId,
				inventoryModuleDbId: options.inventoryModuleDbId,
				clock,
			}),
		],
		authority: options.authority,
		persistence: createDrizzleCommandPersistence(persistenceClient, {}),
		digestKey: options.digestKey,
		clock,
		...(options.createId === undefined ? {} : { createId: options.createId }),
	});
}
