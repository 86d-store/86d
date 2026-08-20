import type { ColumnMeta } from "../col";
import { col } from "../col";

export type CompiledColumn = Readonly<{
	name: string;
	sqlType: string;
	nullable: boolean;
	meta: ColumnMeta;
	checkConstraints: readonly string[];
}>;

export type CompiledTable = Readonly<{
	moduleId: string;
	schemaName: string;
	tableName: string;
	columns: readonly CompiledColumn[];
	primaryKey: readonly string[];
	uniqueConstraints: readonly (readonly string[])[];
	indexes: readonly (readonly string[])[];
	foreignKeys: readonly {
		column: string;
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
		onDelete: string;
	}[];
	excludeConstraints: readonly {
		using: string;
		with: string;
		where?: string;
	}[];
}>;

export type CompileModuleResult = Readonly<{
	moduleId: string;
	tables: readonly CompiledTable[];
}>;

export type CompileReport = Readonly<{
	transcoded: readonly CompileModuleResult[];
	notTranscoded: readonly string[];
	sql: string;
}>;

/** Resolve `col` metadata for a Zod field definition. */
export function readColumnMeta(field: unknown): ColumnMeta {
	if (
		field &&
		typeof field === "object" &&
		"register" in (field as { register?: unknown }) &&
		typeof (field as { register?: unknown }).register === "function"
	) {
		const registered = col.get(field as Parameters<typeof col.get>[0]);
		if (registered) {
			return registered;
		}
	}
	return {};
}
