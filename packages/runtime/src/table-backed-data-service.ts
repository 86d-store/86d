import type {
	ModuleDataService,
	ModuleEntityMap,
} from "@86d-app/core/types/module";

export type SqlExecutor = Readonly<{
	query<T extends Record<string, unknown>>(
		sql: string,
		params?: readonly unknown[],
	): Promise<{ rows: T[] }>;
}>;

export type TableBackedDataServiceConfig = Readonly<{
	moduleId: string;
	executor: SqlExecutor;
	/** Maps entity type to physical table name when they differ. */
	tableNames?: Readonly<Record<string, string>>;
}>;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1_000;

function quoteIdent(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function boundedTake(take: number | undefined): number {
	if (take === undefined) {
		return DEFAULT_PAGE_SIZE;
	}
	if (!Number.isInteger(take) || take < 1) {
		throw new Error("take must be a positive integer.");
	}
	if (take > MAX_PAGE_SIZE) {
		throw new Error(`take must be at most ${MAX_PAGE_SIZE}.`);
	}
	return take;
}

function rowToEntity(row: Record<string, unknown>): Record<string, unknown> {
	const entity: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		if (value instanceof Date) {
			entity[key] = value;
			continue;
		}
		entity[key] = value;
	}
	return entity;
}

/**
 * Table-backed ModuleDataService for compiled Module DDL.
 * Not wired in production; JSON UniversalDataService remains authoritative.
 */
export class TableBackedModuleDataService<
	E extends ModuleEntityMap = ModuleEntityMap,
> implements ModuleDataService<E>
{
	readonly #schemaName: string;
	readonly #executor: SqlExecutor;
	readonly #tableNames: Readonly<Record<string, string>>;

	constructor(config: TableBackedDataServiceConfig) {
		this.#schemaName = `mod_${config.moduleId}`;
		this.#executor = config.executor;
		this.#tableNames = config.tableNames ?? {};
	}

	#tableName(entityType: keyof E & string): string {
		return this.#tableNames[entityType] ?? entityType;
	}

	#qualifiedTable(entityType: keyof E & string): string {
		return `${quoteIdent(this.#schemaName)}.${quoteIdent(this.#tableName(entityType))}`;
	}

	async get<K extends keyof E & string>(
		entityType: K,
		entityId: string,
	): Promise<E[K] | null> {
		const result = await this.#executor.query<Record<string, unknown>>(
			`SELECT * FROM ${this.#qualifiedTable(entityType)} WHERE ${quoteIdent("id")} = $1 LIMIT 1`,
			[entityId],
		);
		const row = result.rows[0];
		return row ? (rowToEntity(row) as E[K]) : null;
	}

	async upsert<K extends keyof E & string>(
		entityType: K,
		entityId: string,
		data: E[K],
	): Promise<void> {
		const record = {
			...(data as Record<string, unknown>),
			id: entityId,
		} as Record<string, unknown>;
		const columns = Object.keys(record);
		const values = columns.map((_, index) => `$${index + 1}`);
		const params = columns.map((column) => record[column]);

		const setClause = columns
			.filter((column) => column !== "id")
			.map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`)
			.join(", ");

		await this.#executor.query(
			`INSERT INTO ${this.#qualifiedTable(entityType)} (${columns.map(quoteIdent).join(", ")})
			 VALUES (${values.join(", ")})
			 ON CONFLICT (${quoteIdent("id")}) DO UPDATE SET ${setClause}`,
			params,
		);
	}

	async delete(entityType: keyof E & string, entityId: string): Promise<void> {
		await this.#executor.query(
			`DELETE FROM ${this.#qualifiedTable(entityType)} WHERE ${quoteIdent("id")} = $1`,
			[entityId],
		);
	}

	async findMany<K extends keyof E & string>(
		entityType: K,
		options?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, "asc" | "desc">;
			take?: number;
			skip?: number;
		},
	): Promise<E[K][]> {
		const where = options?.where ?? {};
		const params: unknown[] = [];
		const filters = Object.entries(where).map(([key, value], index) => {
			params.push(value);
			return `${quoteIdent(key)} = $${index + 1}`;
		});

		let sql = `SELECT * FROM ${this.#qualifiedTable(entityType)}`;
		if (filters.length > 0) {
			sql += ` WHERE ${filters.join(" AND ")}`;
		}

		const orderBy = options?.orderBy ?? {};
		const orderClauses = Object.entries(orderBy).map(
			([column, direction]) =>
				`${quoteIdent(column)} ${direction === "desc" ? "DESC" : "ASC"}`,
		);
		if (orderClauses.length > 0) {
			sql += ` ORDER BY ${orderClauses.join(", ")}`;
		} else {
			sql += ` ORDER BY ${quoteIdent("createdAt")} ASC`;
		}

		const take = boundedTake(options?.take);
		const skip = options?.skip ?? 0;
		params.push(take, skip);
		sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

		const result = await this.#executor.query<Record<string, unknown>>(
			sql,
			params,
		);
		return result.rows.map((row) => rowToEntity(row) as E[K]);
	}
}
