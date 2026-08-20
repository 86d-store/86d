import type { Pool, PoolClient } from "pg";
import type { DrizzleCommandTransaction } from "./command-drizzle";

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

function buildWhereClause(
	where: Record<string, unknown>,
	startIndex = 1,
): { sql: string; values: unknown[] } {
	const parts: string[] = [];
	const values: unknown[] = [];
	let index = startIndex;
	for (const [key, value] of Object.entries(where)) {
		parts.push(`"${key}" = $${index}`);
		values.push(value);
		index += 1;
	}
	return {
		sql: parts.length > 0 ? parts.join(" AND ") : "TRUE",
		values,
	};
}

function createTransaction(client: PoolClient): DrizzleCommandTransaction & {
	_poolClient: PoolClient;
} {
	return {
		_poolClient: client,
		async $queryRawUnsafe<T = unknown>(
			query: string,
			...values: unknown[]
		): Promise<T> {
			const result = await client.query(query, values);
			return result.rows as T;
		},
		async $executeRawUnsafe(
			query: string,
			...values: unknown[]
		): Promise<number> {
			const result = await client.query(query, values);
			return result.rowCount ?? 0;
		},
		commandExecution: {
			async create(args) {
				const data = args.data;
				const columns = Object.keys(data);
				const values = Object.values(data);
				const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
				const columnList = columns.map((c) => `"${c}"`).join(", ");
				await client.query(
					`INSERT INTO "CommandExecution" (${columnList}) VALUES (${placeholders})`,
					values,
				);
				return data;
			},
			async findFirst(args) {
				const { sql, values } = buildWhereClause(
					args.where as Record<string, unknown>,
				);
				const result = await client.query<CommandExecutionRecord>(
					`SELECT * FROM "CommandExecution" WHERE ${sql} LIMIT 1`,
					values,
				);
				return result.rows[0] ?? null;
			},
			async findUnique(args) {
				const result = await client.query<CommandExecutionRecord>(
					`SELECT * FROM "CommandExecution" WHERE "id" = $1 LIMIT 1`,
					[args.where.id],
				);
				return result.rows[0] ?? null;
			},
			async updateMany(args) {
				const dataEntries = Object.entries(args.data);
				const setParts = dataEntries.map(([key], i) => `"${key}" = $${i + 1}`);
				const dataValues = dataEntries.map(([, value]) => value);
				const whereStart = dataValues.length + 1;
				const { sql, values: whereValues } = buildWhereClause(
					args.where as Record<string, unknown>,
					whereStart,
				);
				const result = await client.query(
					`UPDATE "CommandExecution" SET ${setParts.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP WHERE ${sql}`,
					[...dataValues, ...whereValues],
				);
				return { count: result.rowCount ?? 0 };
			},
		},
		auditEvent: {
			async create(args) {
				const data = args.data;
				const columns = Object.keys(data);
				const values = Object.values(data);
				const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
				const columnList = columns.map((c) => `"${c}"`).join(", ");
				await client.query(
					`INSERT INTO "AuditEvent" (${columnList}) VALUES (${placeholders})`,
					values,
				);
				return data;
			},
			async findMany(args) {
				const result = await client.query<AuditEventRecord>(
					`SELECT * FROM "AuditEvent" WHERE "commandExecutionId" = $1 ORDER BY "occurredAt" ASC, "sequence" ASC`,
					[args.where.commandExecutionId],
				);
				return result.rows;
			},
		},
	};
}

export type PersistenceTransaction = DrizzleCommandTransaction & {
	_poolClient: PoolClient;
};

/**
 * Persistence client for Commands / grants / confirmations over a pg Pool.
 * Same transactional surface command/grant adapters expect.
 * Attach `_poolClient` so Module data services can join the transaction.
 */
export function createDrizzlePersistenceClient(pool: Pool): {
	$transaction<T>(
		run: (transaction: PersistenceTransaction) => Promise<T>,
	): Promise<T>;
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
	$executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
} {
	return {
		async $transaction<T>(
			run: (transaction: PersistenceTransaction) => Promise<T>,
		): Promise<T> {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const result = await run(createTransaction(client));
				await client.query("COMMIT");
				return result;
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			} finally {
				client.release();
			}
		},
		async $queryRawUnsafe<T = unknown>(
			query: string,
			...values: unknown[]
		): Promise<T> {
			const result = await pool.query(query, values);
			return result.rows as T;
		},
		async $executeRawUnsafe(
			query: string,
			...values: unknown[]
		): Promise<number> {
			const result = await pool.query(query, values);
			return result.rowCount ?? 0;
		},
	};
}
