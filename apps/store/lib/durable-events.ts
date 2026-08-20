/**
 * Durable event delivery for this Store Runtime.
 *
 * The dispatcher creates no timer and no background process: a caller decides
 * when to drain. Delivery is at-least-once and every consumer commits its effect
 * with a dedupe receipt, so draining more often than necessary is harmless and
 * draining late only delays delivery.
 */

import type { Module } from "@86d-app/core/types/module";
import { CompiledModuleDataService } from "@86d-app/runtime/compiled-module-data-service";
import {
	compiledForModule,
	compileInstalledModules,
} from "@86d-app/runtime/compiled-schema-boot";
import {
	createDrizzlePersistenceClient,
	type PersistenceTransaction,
} from "@86d-app/runtime/drizzle-persistence-client";
import {
	type DrainDurableEventsResult,
	DurableEventDispatcher,
} from "@86d-app/runtime/durable-event-dispatcher";
import type { ModuleRegistry } from "@86d-app/runtime/registry";
import { getPool } from "db";
import { drizzle } from "drizzle-orm/node-postgres";
import env from "env";
import { logger } from "utils/logger";
import { modules } from "../generated/api";

/** Deliveries claimed per drain. Bounded so one request cannot stall on a backlog. */
const DRAIN_LIMIT = 20;

/** A claimed delivery is redeliverable after this lease expires. */
const LEASE_MS = 30_000;

let dispatcher: DurableEventDispatcher | undefined;
let dispatcherRegistry: ModuleRegistry | undefined;
let draining: Promise<DrainDurableEventsResult> | undefined;
const compiledBundle = compileInstalledModules(modules as Module[]);

const EMPTY_DRAIN_RESULT: DrainDurableEventsResult = {
	claimed: 0,
	succeeded: 0,
	failed: 0,
	deadLettered: 0,
};

function getDispatcher(
	registry: ModuleRegistry,
	storeId: string,
): DurableEventDispatcher | undefined {
	if (dispatcher && dispatcherRegistry === registry) return dispatcher;

	const consumers = registry.getDurableEventConsumers();
	if (consumers.length === 0) {
		dispatcherRegistry = registry;
		dispatcher = undefined;
		return undefined;
	}

	const persistence = createDrizzlePersistenceClient(getPool());
	dispatcher = new DurableEventDispatcher({
		db: persistence,
		storeId,
		consumers,
		getConsumerData: (moduleId, transaction) => {
			const moduleDbId = registry.getModuleDbId(moduleId);
			if (!moduleDbId) {
				throw new Error(`Module "${moduleId}" is not initialized.`);
			}
			const client = (transaction as PersistenceTransaction)._poolClient;
			if (!client) {
				throw new Error("Durable event transaction is missing a pool client.");
			}
			return new CompiledModuleDataService({
				db: drizzle(client),
				storeId,
				moduleId,
				moduleDbId,
				compiled: compiledForModule(compiledBundle, moduleId),
			});
		},
	});
	dispatcherRegistry = registry;
	return dispatcher;
}

/** Deliver one bounded batch and surface infrastructure failures to a worker. */
export async function drainDurableEventsBatch(
	registry: ModuleRegistry,
): Promise<DrainDurableEventsResult> {
	const storeId = env.STORE_ID;
	if (!storeId || !registry.isReady()) return EMPTY_DRAIN_RESULT;

	const active = getDispatcher(registry, storeId);
	if (!active) return EMPTY_DRAIN_RESULT;

	if (draining) return draining;

	draining = active
		.drain({ limit: DRAIN_LIMIT, leaseDurationMs: LEASE_MS })
		.finally(() => {
			draining = undefined;
		});

	try {
		return await draining;
	} catch (error) {
		logger.error("Durable event drain failed", {
			reason: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/** Alias kept for request-path call sites that drain after mutations. */
export const drainDurableEvents = drainDurableEventsBatch;

/** Fire-and-forget drain after a mutation; failures are logged, never thrown. */
export function scheduleDurableEventDrain(registry: ModuleRegistry): void {
	void drainDurableEventsBatch(registry).catch(() => {
		// Already logged inside drainDurableEventsBatch.
	});
}
