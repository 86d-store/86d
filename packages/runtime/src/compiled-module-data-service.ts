import type {
	AnyDurableEventDefinition,
	DurableEventEnvelope,
	DurableEventInput,
	LockingModuleDataTransaction,
	ModuleDataTransaction,
} from "@86d-app/core/durable-events";
import type { CompiledTable, CompileModuleResult } from "@86d-app/core/schema";
import { parseStorageRead, parseStorageWrite } from "@86d-app/core/schema";
import type {
	ModuleDataService,
	ModuleEntityMap,
} from "@86d-app/core/types/module";
import { and, asc, count, desc, eq, type SQL, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
	boolean as booleanColumn,
	char,
	doublePrecision,
	integer,
	jsonb,
	pgSchema,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";

type Db<TSchema extends Record<string, unknown> = Record<string, unknown>> =
	| PgliteDatabase<TSchema>
	| NodePgDatabase<TSchema>;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1_000;

function buildColumn(column: CompiledTable["columns"][number]) {
	const name = column.name;
	const nullable = column.nullable;

	switch (column.sqlType) {
		case "integer":
			return nullable ? integer(name) : integer(name).notNull();
		case "double precision":
			return nullable ? doublePrecision(name) : doublePrecision(name).notNull();
		case "boolean":
			return nullable ? booleanColumn(name) : booleanColumn(name).notNull();
		case "jsonb":
			return nullable ? jsonb(name) : jsonb(name).notNull();
		case "uuid":
			return nullable ? uuid(name) : uuid(name).notNull();
		case "timestamptz":
			return nullable
				? timestamp(name, { withTimezone: true, mode: "string" })
				: timestamp(name, { withTimezone: true, mode: "string" }).notNull();
		default:
			if (column.sqlType.startsWith("varchar(")) {
				const length = Number.parseInt(
					column.sqlType.slice("varchar(".length, -1),
					10,
				);
				return nullable
					? varchar(name, { length })
					: varchar(name, { length }).notNull();
			}
			if (column.sqlType.startsWith("char(")) {
				const length = Number.parseInt(
					column.sqlType.slice("char(".length, -1),
					10,
				);
				return nullable
					? char(name, { length })
					: char(name, { length }).notNull();
			}
			return nullable ? text(name) : text(name).notNull();
	}
}

function buildDrizzleTable(compiled: CompiledTable): PgTable {
	const schema = pgSchema(compiled.schemaName);
	const columns: Record<string, ReturnType<typeof buildColumn>> = {};

	for (const column of compiled.columns) {
		columns[column.name] = buildColumn(column);
	}

	return schema.table(compiled.tableName, columns);
}

function tableKey(moduleId: string, entityType: string): string {
	return `${moduleId}:${entityType}`;
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

function normalizeJson(value: unknown): unknown {
	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(value);
	} catch {
		throw new Error("Durable event payload must be JSON serializable.");
	}
	if (serialized === undefined || serialized.length > 262_144) {
		throw new Error("Durable event payload must be bounded JSON.");
	}
	return JSON.parse(serialized) as unknown;
}

function boundedText(value: string, label: string, maximum: number): void {
	if (value.length === 0 || value.length > maximum) {
		throw new Error(
			`${label} must contain between 1 and ${maximum} characters.`,
		);
	}
}

function serializeRowForInsert(
	row: Record<string, unknown>,
): Record<string, unknown> {
	const serialized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		if (value instanceof Date) {
			serialized[key] = value.toISOString();
		} else {
			serialized[key] = value;
		}
	}
	return serialized;
}

function rowToEntity(row: Record<string, unknown>): Record<string, unknown> {
	const entity: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		entity[key] = value instanceof Date ? value : value;
	}
	return entity;
}

export type CompiledModuleDataServiceConfig<
	TSchema extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
	db: Db<TSchema>;
	storeId: string;
	moduleId: string;
	moduleDbId: string;
	compiled: readonly CompileModuleResult[];
}>;

/**
 * Production ModuleDataService over compiled `mod_<moduleId>` tables.
 * Uses the Drizzle query builder only — no ModuleData JSON path.
 */
export class CompiledModuleDataService<
	E extends ModuleEntityMap = ModuleEntityMap,
	TSchema extends Record<string, unknown> = Record<string, unknown>,
> implements ModuleDataService<E>
{
	readonly #db: Db<TSchema>;
	readonly #storeId: string;
	readonly #moduleId: string;
	readonly #moduleDbId: string;
	readonly #tables = new Map<string, PgTable>();
	readonly #compiled = new Map<string, CompiledTable>();

	constructor(config: CompiledModuleDataServiceConfig<TSchema>) {
		this.#db = config.db;
		this.#storeId = config.storeId;
		this.#moduleId = config.moduleId;
		this.#moduleDbId = config.moduleDbId;
		for (const moduleResult of config.compiled) {
			if (moduleResult.moduleId !== config.moduleId) {
				continue;
			}
			for (const table of moduleResult.tables) {
				const key = tableKey(moduleResult.moduleId, table.tableName);
				this.#compiled.set(key, table);
				this.#tables.set(key, buildDrizzleTable(table));
			}
		}
	}

	#requireTable(entityType: string): {
		table: PgTable;
		compiled: CompiledTable;
	} {
		const key = tableKey(this.#moduleId, entityType);
		const table = this.#tables.get(key);
		const compiled = this.#compiled.get(key);
		if (!table || !compiled) {
			throw new Error(`No compiled table for ${this.#moduleId}.${entityType}`);
		}
		return { table, compiled };
	}

	#scoped(db: Db): CompiledModuleDataService<E> {
		return new CompiledModuleDataService({
			db,
			storeId: this.#storeId,
			moduleId: this.#moduleId,
			moduleDbId: this.#moduleDbId,
			compiled: [...this.#compiled.values()].map((table) => ({
				moduleId: this.#moduleId,
				tables: [table],
				errors: [],
			})),
		});
	}

	async get<K extends keyof E & string>(
		entityType: K,
		entityId: string,
	): Promise<E[K] | null> {
		const { table, compiled } = this.#requireTable(entityType);
		const rows = await this.#db
			.select()
			.from(table)
			.where(sql`"id" = ${entityId}`)
			.limit(1);
		const row = rows[0];
		if (!row) {
			return null;
		}
		const entity = rowToEntity(row as Record<string, unknown>);
		return parseStorageRead(compiled, entity) as E[K];
	}

	async getForUpdate(
		entityType: string,
		entityId: string,
	): Promise<Record<string, unknown> | null> {
		const { table, compiled } = this.#requireTable(entityType);
		const rows = await this.#db
			.select()
			.from(table)
			.where(sql`"id" = ${entityId}`)
			.limit(1)
			.for("update");
		const row = rows[0];
		if (!row) {
			return null;
		}
		const entity = rowToEntity(row as Record<string, unknown>);
		return parseStorageRead(compiled, entity);
	}

	async upsert<K extends keyof E & string>(
		entityType: K,
		entityId: string,
		data: E[K],
	): Promise<void> {
		const { table, compiled } = this.#requireTable(entityType);
		const parsed = parseStorageWrite(compiled, {
			...(data as Record<string, unknown>),
			id: entityId,
		});
		const record = serializeRowForInsert(parsed);
		const pkColumns =
			compiled.primaryKey.length > 0 ? compiled.primaryKey : ["id"];
		const tableColumns = table as unknown as Record<string, PgColumn>;
		const conflictTarget = pkColumns.map((column) => tableColumns[column]);
		await this.#db.insert(table).values(record).onConflictDoUpdate({
			target: conflictTarget,
			set: record,
		});
	}

	async delete(entityType: keyof E & string, entityId: string): Promise<void> {
		const { table } = this.#requireTable(entityType);
		await this.#db.delete(table).where(sql`"id" = ${entityId}`);
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
		const { table, compiled } = this.#requireTable(entityType);
		const tableColumns = table as unknown as Record<string, PgColumn>;
		const filters: SQL[] = [];
		if (options?.where) {
			for (const [key, value] of Object.entries(options.where)) {
				const column = tableColumns[key];
				if (!column) {
					throw new Error(
						`Unknown column "${key}" on ${this.#moduleId}.${entityType}`,
					);
				}
				filters.push(eq(column, value));
			}
		}

		let query = this.#db.select().from(table);
		if (filters.length > 0) {
			query = query.where(and(...filters)) as typeof query;
		}

		const orderEntries = options?.orderBy
			? Object.entries(options.orderBy)
			: ([["createdAt", "desc"]] as const);
		for (const [columnName, direction] of orderEntries) {
			const column = tableColumns[columnName];
			if (!column) {
				continue;
			}
			query = query.orderBy(
				direction === "asc" ? asc(column) : desc(column),
			) as typeof query;
		}

		const take = boundedTake(options?.take);
		query = query.limit(take) as typeof query;
		if (options?.skip !== undefined) {
			query = query.offset(options.skip) as typeof query;
		}

		const rows = await query;
		return rows.map((row) => {
			const entity = rowToEntity(row as Record<string, unknown>);
			return parseStorageRead(compiled, entity) as E[K];
		});
	}

	async count(
		entityType: string,
		where?: Record<string, unknown>,
	): Promise<number> {
		const { table } = this.#requireTable(entityType);
		const tableColumns = table as unknown as Record<string, PgColumn>;
		const filters: SQL[] = [];
		if (where) {
			for (const [key, value] of Object.entries(where)) {
				const column = tableColumns[key];
				if (!column) {
					throw new Error(
						`Unknown column "${key}" on ${this.#moduleId}.${entityType}`,
					);
				}
				filters.push(eq(column, value));
			}
		}
		const result = await this.#db
			.select({ value: count() })
			.from(table)
			.where(filters.length > 0 ? and(...filters) : undefined);
		return Number(result[0]?.value ?? 0);
	}

	async upsertMany(
		entities: Array<{
			entityType: string;
			entityId: string;
			data: Record<string, unknown>;
		}>,
	): Promise<void> {
		await this.#db.transaction(async (tx) => {
			const scoped = this.#scoped(tx as unknown as Db);
			for (const entity of entities) {
				await scoped.upsert(
					entity.entityType,
					entity.entityId,
					entity.data as E[string],
				);
			}
		});
	}

	async transaction<T>(
		work: (transaction: ModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		return this.#db.transaction(async (tx) => {
			return work(this.transactionContext(tx as unknown as Db));
		});
	}

	currentTransaction(): LockingModuleDataTransaction {
		return this.transactionContext(this.#db);
	}

	private transactionContext(db: Db): LockingModuleDataTransaction {
		const ownerData = this.#scoped(db);
		return Object.assign(ownerData, {
			emit: <D extends AnyDurableEventDefinition>(
				definition: D,
				input: DurableEventInput<D>,
			): Promise<DurableEventEnvelope<D>> =>
				this.persistEvent(db, definition, input),
			getForUpdate: (entityType: string, entityId: string) =>
				ownerData.getForUpdate(entityType, entityId),
		});
	}

	private async persistEvent<D extends AnyDurableEventDefinition>(
		db: Db,
		definition: D,
		input: DurableEventInput<D>,
	): Promise<DurableEventEnvelope<D>> {
		if (definition.owner !== this.#moduleId) {
			throw new Error(
				`Durable event "${definition.name}" is owned by Module "${definition.owner}", not "${this.#moduleId}".`,
			);
		}
		boundedText(definition.name, "Durable event name", 200);
		boundedText(input.aggregate.type, "Aggregate type", 100);
		boundedText(input.aggregate.id, "Aggregate ID", 255);
		if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
			throw new Error("Durable event version must be a positive integer.");
		}
		const payload = definition.payload.safeParse(input.payload);
		if (!payload.success) {
			throw new Error(
				`Durable event payload is invalid for ${definition.name}.`,
			);
		}
		const normalizedPayload = normalizeJson(payload.data);
		const normalized = definition.payload.safeParse(normalizedPayload);
		if (!normalized.success) {
			throw new Error(
				`Durable event payload is not stable JSON for ${definition.name}.`,
			);
		}
		const eventId = input.id ?? crypto.randomUUID();
		const occurredAt = input.occurredAt ?? new Date();
		const occurredAtIso =
			occurredAt instanceof Date
				? occurredAt.toISOString()
				: String(occurredAt);

		const sequenceResult = await (
			db as unknown as {
				execute: (
					q: unknown,
				) => Promise<{ rows: Array<{ sequence: number | bigint }> }>;
			}
		).execute(
			sql`INSERT INTO "ModuleEventSequence" (
				"storeId", "sourceModule", "aggregateType", "aggregateId", "lastSequence"
			) VALUES (${this.#storeId}::uuid, ${this.#moduleId}, ${input.aggregate.type}, ${input.aggregate.id}, 1)
			ON CONFLICT ("storeId", "sourceModule", "aggregateType", "aggregateId")
			DO UPDATE SET "lastSequence" = "ModuleEventSequence"."lastSequence" + 1
			RETURNING "lastSequence" AS "sequence"`,
		);

		const sequence = sequenceResult.rows?.[0]?.sequence;
		const sequenceNumber =
			typeof sequence === "bigint" ? Number(sequence) : Number(sequence);
		if (
			!Number.isFinite(sequenceNumber) ||
			sequenceNumber < 1 ||
			sequenceNumber > Number.MAX_SAFE_INTEGER
		) {
			throw new Error("Could not allocate a durable event sequence.");
		}

		await (
			db as unknown as {
				execute: (q: unknown) => Promise<unknown>;
			}
		).execute(
			sql`INSERT INTO "ModuleOutboxEvent" (
				"id", "eventType", "schemaVersion", "storeId", "sourceModule",
				"aggregateType", "aggregateId", "aggregateSequence", "occurredAt",
				"payload", "deliveryState", "attempts", "nextAttemptAt", "moduleId"
			) VALUES (
				${eventId}::uuid, ${definition.name}, ${definition.version},
				${this.#storeId}::uuid, ${this.#moduleId},
				${input.aggregate.type}, ${input.aggregate.id}, ${sequenceNumber},
				${occurredAtIso}::timestamptz, ${JSON.stringify(normalized.data)}::jsonb,
				'pending', 0, ${occurredAtIso}::timestamptz, ${this.#moduleDbId}::uuid
			)`,
		);

		return {
			id: eventId,
			name: definition.name,
			version: definition.version,
			storeId: this.#storeId,
			sourceModule: definition.owner,
			aggregate: {
				type: input.aggregate.type,
				id: input.aggregate.id,
				sequence: sequenceNumber,
			},
			occurredAt,
			payload: normalized.data as DurableEventEnvelope<D>["payload"],
		};
	}
}

export { buildDrizzleTable };
