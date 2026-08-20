import type {
	CompiledColumn,
	CompiledTable,
	CompileModuleResult,
} from "@86d-app/core/schema";
import { parseStorageRead, parseStorageWrite } from "@86d-app/core/schema";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
	boolean as booleanColumn,
	char,
	doublePrecision,
	integer,
	jsonb,
	type PgTable,
	pgSchema,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";

type ShadowDatabase = PgliteDatabase<Record<string, unknown>> | NodePgDatabase;

function buildColumn(column: CompiledColumn) {
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

function normalizeValue(value: unknown): unknown {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		const sorted = Object.keys(value as Record<string, unknown>)
			.sort((a, b) => a.localeCompare(b))
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
				return acc;
			}, {});
		return sorted;
	}
	if (Array.isArray(value)) {
		return value.map(normalizeValue);
	}
	return value;
}

export function valuesEqual(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
): boolean {
	const keysA = Object.keys(a).sort((x, y) => x.localeCompare(y));
	const keysB = Object.keys(b).sort((x, y) => x.localeCompare(y));
	if (keysA.length !== keysB.length) {
		return false;
	}
	for (const key of keysA) {
		if (!keysB.includes(key)) {
			return false;
		}
		const normalizedA = normalizeValue(a[key]);
		const normalizedB = normalizeValue(b[key]);
		if (JSON.stringify(normalizedA) !== JSON.stringify(normalizedB)) {
			return false;
		}
	}
	return true;
}

export function serializeRowForInsert(
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

export type ShadowTableStoreConfig = Readonly<{
	db: ShadowDatabase;
	compiled: readonly CompileModuleResult[];
}>;

/** Drizzle-backed shadow table access for compiled Module DDL. */
export class ShadowTableStore {
	readonly #db: ShadowDatabase;
	readonly #tables = new Map<string, PgTable>();
	readonly #compiled = new Map<string, CompiledTable>();

	constructor(config: ShadowTableStoreConfig) {
		this.#db = config.db;
		for (const moduleResult of config.compiled) {
			for (const table of moduleResult.tables) {
				const entityType = table.tableName;
				const key = tableKey(moduleResult.moduleId, entityType);
				this.#compiled.set(key, table);
				this.#tables.set(key, buildDrizzleTable(table));
			}
		}
	}

	hasTable(moduleId: string, entityType: string): boolean {
		return this.#tables.has(tableKey(moduleId, entityType));
	}

	getCompiledTable(
		moduleId: string,
		entityType: string,
	): CompiledTable | undefined {
		return this.#compiled.get(tableKey(moduleId, entityType));
	}

	async insert(
		moduleId: string,
		entityType: string,
		entityId: string,
		row: Record<string, unknown>,
	): Promise<void> {
		const key = tableKey(moduleId, entityType);
		const table = this.#tables.get(key);
		const compiled = this.#compiled.get(key);
		if (!table || !compiled) {
			throw new Error(`No shadow table for ${moduleId}.${String(entityType)}`);
		}
		const parsed = parseStorageWrite(compiled, {
			...row,
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

	async get(
		moduleId: string,
		entityType: string,
		entityId: string,
	): Promise<Record<string, unknown> | null> {
		const key = tableKey(moduleId, entityType);
		const table = this.#tables.get(key);
		const compiled = this.#compiled.get(key);
		if (!table || !compiled) {
			return null;
		}
		const rows = await this.#db
			.select()
			.from(table)
			.where(sql`"id" = ${entityId}`)
			.limit(1);
		const row = rows[0];
		if (!row) {
			return null;
		}
		return parseStorageRead(compiled, row as Record<string, unknown>);
	}

	async delete(
		moduleId: string,
		entityType: string,
		entityId: string,
	): Promise<void> {
		const table = this.#tables.get(tableKey(moduleId, entityType));
		if (!table) {
			return;
		}
		await this.#db.delete(table).where(sql`"id" = ${entityId}`);
	}
}
