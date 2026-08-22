import type { ZodObject, ZodRawShape } from "../../zod";
import type { ColumnMeta } from "../col";
import { col } from "../col";
import { getZodDef } from "./zod-inspect";

export type CompiledColumn = Readonly<{
	name: string;
	sqlType: string;
	/** Stored nullability (NULL allowed in the column). */
	nullable: boolean;
	/** Input optionality (field may be omitted on write). */
	optional: boolean;
	/** Zod `.nullable()` — null is a valid input/output value. */
	acceptsNull: boolean;
	meta: ColumnMeta;
	checkConstraints: readonly string[];
	sqlDefault?: string;
	enumValues?: readonly string[];
}>;

export type CompiledTable = Readonly<{
	moduleId: string;
	schemaName: string;
	tableName: string;
	shape: ZodObject<ZodRawShape>;
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
		using: "gist" | "btree" | string;
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

export type CompileProvenance = Readonly<{
	moduleId: string;
	tableName: string;
	fieldName: string;
}>;

/** Fail-closed compile error with Module/table/field provenance. */
export class SchemaCompileError extends Error {
	readonly provenance: CompileProvenance;

	constructor(message: string, provenance: CompileProvenance) {
		super(
			`${message} (${provenance.moduleId}.${provenance.tableName}.${provenance.fieldName})`,
		);
		this.name = "SchemaCompileError";
		this.provenance = provenance;
	}
}

/** Resolve `col` metadata for a Zod field, walking wrappers. */
export function readColumnMeta(field: unknown): ColumnMeta {
	let current: unknown = field;
	for (let depth = 0; depth < 8; depth += 1) {
		if (
			current &&
			typeof current === "object" &&
			"register" in (current as { register?: unknown }) &&
			typeof (current as { register?: unknown }).register === "function"
		) {
			const registered = col.get(current as Parameters<typeof col.get>[0]);
			if (registered) {
				return registered;
			}
		}
		const def = getZodDef(current);
		const inner = def?.innerType;
		if (!inner || typeof inner !== "object") {
			break;
		}
		current = inner;
	}
	return {};
}
