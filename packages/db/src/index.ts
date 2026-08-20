import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type {
	CorePartyInput,
	CoreSubjectInput,
	CoreTransactionInput,
} from "./core-money";
import { writeCoreMoney } from "./core-money";
import * as frameworkSchema from "./schema";
import * as coreSchema from "./schema/core";

const schema = {
	...frameworkSchema,
	...coreSchema,
};

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
	drizzleDb: Database | undefined;
	drizzlePool: Pool | undefined;
};

function createPool(): Pool {
	const connectionString = process.env.DATABASE_URL;
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

export type { CorePartyInput, CoreSubjectInput, CoreTransactionInput };
export { getPool, writeCoreMoney };
