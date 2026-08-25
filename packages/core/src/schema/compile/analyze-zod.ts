import type { ZodObject, ZodRawShape, ZodType } from "../../zod";
import {
	type CompiledColumn,
	type CompiledTable,
	readColumnMeta,
	SchemaCompileError,
} from "./types";
import {
	classifyZodBase,
	readEnumValues,
	readFiniteChecks,
	unwrapFieldWrappers,
} from "./zod-inspect";

function sqlLiteral(value: unknown): string | undefined {
	if (value === null) {
		return "NULL";
	}
	if (typeof value === "boolean") {
		return value ? "TRUE" : "FALSE";
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	if (typeof value === "string") {
		return `'${value.replaceAll("'", "''")}'`;
	}
	if (value instanceof Date) {
		return "now()";
	}
	if (Array.isArray(value) || (value !== null && typeof value === "object")) {
		return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
	}
	return undefined;
}

function zodToSqlType(
	schema: ZodType,
	provenance: {
		moduleId: string;
		tableName: string;
		fieldName: string;
	},
): string {
	const base = classifyZodBase(schema);
	const checks = readFiniteChecks(schema);

	switch (base) {
		case "string":
			if (typeof checks.maxLength === "number") {
				return `varchar(${checks.maxLength})`;
			}
			return "text";
		case "uuid":
			return "uuid";
		case "number":
			return "double precision";
		case "int":
		case "integer":
			return "integer";
		case "boolean":
			return "boolean";
		case "date":
		case "date.coerce":
			return "timestamptz";
		case "enum":
			return "text";
		case "array":
		case "record":
		case "object":
			return "jsonb";
		default:
			throw new SchemaCompileError(
				`Unsupported Zod construct "${base}"`,
				provenance,
			);
	}
}

function zodChecksToSql(fieldName: string, schema: ZodType): string[] {
	const checks: string[] = [];
	const bounds = readFiniteChecks(schema);
	const base = classifyZodBase(schema);
	const lengthExpression =
		base === "string"
			? `char_length("${fieldName}")`
			: base === "array"
				? `jsonb_array_length("${fieldName}")`
				: undefined;

	if (bounds.minValue !== undefined) {
		checks.push(`"${fieldName}" >= ${bounds.minValue}`);
	}
	if (bounds.maxValue !== undefined) {
		checks.push(`"${fieldName}" <= ${bounds.maxValue}`);
	}
	if (bounds.minLength !== undefined && lengthExpression) {
		checks.push(`${lengthExpression} >= ${bounds.minLength}`);
	}
	// maxLength becomes varchar(N) column width; skip redundant CHECK when width set.
	if (
		bounds.maxLength !== undefined &&
		lengthExpression &&
		!(base === "string" && typeof bounds.maxLength === "number")
	) {
		checks.push(`${lengthExpression} <= ${bounds.maxLength}`);
	}

	const enumValues = readEnumValues(schema);
	if (enumValues && enumValues.length > 0) {
		const list = enumValues
			.map((value) => `'${value.replaceAll("'", "''")}'`)
			.join(", ");
		checks.push(`"${fieldName}" IN (${list})`);
	}

	return checks;
}

function parseReference(
	moduleId: string,
	ref: NonNullable<ReturnType<typeof readColumnMeta>["references"]>,
): {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
} {
	const [scope, table] = ref.table.split(".");
	if (scope === "core") {
		return {
			referencedSchema: "core",
			referencedTable: table ?? ref.table,
			referencedColumn: ref.column,
		};
	}
	if (scope === "self" && table) {
		return {
			referencedSchema: `mod_${moduleId}`,
			referencedTable: table,
			referencedColumn: ref.column,
		};
	}
	return {
		referencedSchema: `mod_${moduleId}`,
		referencedTable: ref.table,
		referencedColumn: ref.column,
	};
}

function compileColumn(input: {
	moduleId: string;
	tableName: string;
	fieldName: string;
	fieldSchema: ZodType;
}): CompiledColumn {
	const provenance = {
		moduleId: input.moduleId,
		tableName: input.tableName,
		fieldName: input.fieldName,
	};
	const wrappers = unwrapFieldWrappers(input.fieldSchema);
	const meta = readColumnMeta(input.fieldSchema);
	const isPk = meta.pk === true;
	const sqlType = zodToSqlType(wrappers.inner, provenance);
	const checkConstraints = zodChecksToSql(input.fieldName, wrappers.inner);
	const enumValues = readEnumValues(wrappers.inner);

	// Stored nullability: optional/nullable wrappers; PK columns stay NOT NULL.
	const nullable = isPk ? false : wrappers.optional || wrappers.nullable;

	let sqlDefault: string | undefined;
	if (wrappers.hasDefault) {
		sqlDefault = sqlLiteral(wrappers.defaultValue);
	}

	return {
		name: input.fieldName,
		sqlType,
		nullable,
		optional: wrappers.optional || wrappers.hasDefault,
		acceptsNull: wrappers.nullable,
		meta,
		checkConstraints,
		...(sqlDefault !== undefined ? { sqlDefault } : {}),
		...(enumValues ? { enumValues } : {}),
	};
}

/** Compile one Zod object shape into a table definition. */
export function compileTableShape(input: {
	moduleId: string;
	tableName: string;
	shape: ZodObject<ZodRawShape>;
	excludes?: readonly {
		using: "gist" | "btree";
		with: string;
		where?: string;
	}[];
}): CompiledTable {
	const schemaName = `mod_${input.moduleId}`;
	const columns: CompiledColumn[] = [];
	const primaryKey: string[] = [];
	const uniqueConstraints: string[][] = [];
	const indexes: string[][] = [];
	const foreignKeys: CompiledTable["foreignKeys"][number][] = [];

	const shape = input.shape.shape;
	for (const [fieldName, fieldSchema] of Object.entries(shape)) {
		const column = compileColumn({
			moduleId: input.moduleId,
			tableName: input.tableName,
			fieldName,
			fieldSchema: fieldSchema as ZodType,
		});
		columns.push(column);

		if (column.meta.pk) {
			primaryKey.push(fieldName);
		}
		if (column.meta.unique) {
			uniqueConstraints.push([fieldName]);
		}
		if (column.meta.index && !column.meta.unique) {
			indexes.push([fieldName]);
		}
		if (column.meta.references) {
			const parsed = parseReference(input.moduleId, column.meta.references);
			foreignKeys.push({
				column: fieldName,
				referencedSchema: parsed.referencedSchema,
				referencedTable: parsed.referencedTable,
				referencedColumn: parsed.referencedColumn,
				onDelete: column.meta.references.onDelete ?? "no action",
			});
		}
	}

	if (primaryKey.length === 0 && columns.some((c) => c.name === "id")) {
		primaryKey.push("id");
	}

	return {
		moduleId: input.moduleId,
		schemaName,
		tableName: input.tableName,
		shape: input.shape,
		columns,
		primaryKey,
		uniqueConstraints,
		indexes,
		foreignKeys,
		excludeConstraints: input.excludes ?? [],
	};
}
