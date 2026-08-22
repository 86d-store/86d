import { drizzle } from "drizzle-orm/node-postgres";
import { getProcessEnv } from "env/process-env";
import { Pool } from "pg";
import {
	coreSchema,
	coreTables,
	moduleConfig,
	party,
	subject,
	transaction,
} from "./schema/core";
import {
	accountRelations,
	approvalRelations,
	auditEventRelations,
	changeSetRelations,
	commandExecutionRelations,
	confirmationRelations,
	fileRelations,
	invitationRelations,
	logRelations,
	moduleEventConsumptionRelations,
	moduleEventDeliveryRelations,
	moduleEventSequenceRelations,
	moduleOutboxEventRelations,
	moduleRelations,
	passkeyRelations,
	sessionRelations,
	standingPermissionRelations,
	standingPermissionUseReservationRelations,
	userRelations,
	webhookDeliveryRelations,
	webhookRelations,
	workflowAttemptRelations,
	workflowRelations,
	workflowStepRelations,
} from "./schema/relations";
import {
	account,
	approval,
	auditEvent,
	changeSet,
	commandExecution,
	confirmation,
	file,
	invitation,
	log,
	module,
	moduleEventConsumption,
	moduleEventDelivery,
	moduleEventSequence,
	moduleOutboxEvent,
	passkey,
	session,
	standingPermission,
	standingPermissionUseReservation,
	user,
	verification,
	webhook,
	webhookDelivery,
	workflow,
	workflowAttempt,
	workflowStep,
} from "./schema/tables";

export type {
	CorePartyInput,
	CoreSubjectInput,
	CoreTransactionInput,
} from "./core-money";

const schema = {
	account,
	accountRelations,
	approval,
	approvalRelations,
	auditEvent,
	auditEventRelations,
	changeSet,
	changeSetRelations,
	commandExecution,
	commandExecutionRelations,
	confirmation,
	confirmationRelations,
	file,
	fileRelations,
	invitation,
	invitationRelations,
	log,
	logRelations,
	module,
	moduleEventConsumption,
	moduleEventConsumptionRelations,
	moduleEventDelivery,
	moduleEventDeliveryRelations,
	moduleEventSequence,
	moduleEventSequenceRelations,
	moduleOutboxEvent,
	moduleOutboxEventRelations,
	moduleRelations,
	passkey,
	passkeyRelations,
	session,
	sessionRelations,
	standingPermission,
	standingPermissionRelations,
	standingPermissionUseReservation,
	standingPermissionUseReservationRelations,
	user,
	userRelations,
	verification,
	webhook,
	webhookDelivery,
	webhookDeliveryRelations,
	webhookRelations,
	workflow,
	workflowAttempt,
	workflowAttemptRelations,
	workflowRelations,
	workflowStep,
	workflowStepRelations,
	coreSchema,
	party,
	subject,
	transaction,
	moduleConfig,
	coreTables,
};

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
	drizzleDb: Database | undefined;
	drizzlePool: Pool | undefined;
};

function createPool(): Pool {
	const connectionString = getProcessEnv("DATABASE_URL");
	if (!connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}
	return new Pool({ connectionString });
}

function getPool(): Pool {
	if (!globalForDb.drizzlePool) {
		globalForDb.drizzlePool = createPool();
	}
	return globalForDb.drizzlePool;
}

function createClient(): Database {
	return drizzle(getPool(), { schema });
}

function getClient(): Database {
	if (!globalForDb.drizzleDb) {
		globalForDb.drizzleDb = createClient();
	}
	return globalForDb.drizzleDb;
}

/**
 * Lazy-initialized Drizzle client.
 * The connection is created on first property access, not at import time.
 * This allows the store app to build without DATABASE_URL.
 */
export const db: Database = new Proxy({} as Database, {
	get(_target, prop) {
		const client = getClient();
		const value = Reflect.get(client, prop, client);
		if (typeof value === "function") {
			return (value as (...args: Array<unknown>) => unknown).bind(client);
		}
		return value;
	},
});

export { getPool };
