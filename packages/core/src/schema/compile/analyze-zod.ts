import type { z } from "zod";
import {
	type CompiledColumn,
	type CompiledTable,
	readColumnMeta,
} from "./types";

type ZodDef = {
	type?: string;
	typeName?: string;
	innerType?: unknown;
	checks?: readonly { kind?: string; value?: unknown }[];
};

function getZodDef(schema: z.ZodType): ZodDef | undefined {
	const withZod = schema as { _zod?: { def?: ZodDef }; def?: ZodDef };
	return withZod._zod?.def ?? withZod.def;
}

function unwrapOptional(schema: z.ZodType): {
	inner: z.ZodType;
	nullable: boolean;
} {
	let current: z.ZodType = schema;
	let nullable = false;

	for (;;) {
		const def = getZodDef(current);
		const typeName = def?.type ?? def?.typeName;
		if (typeName === "optional" || typeName === "nullable") {
			nullable = true;
			const inner = def?.innerType;
			if (!inner || typeof inner !== "object") {
				break;
			}
			current = inner as z.ZodType;
			continue;
		}
		break;
	}

	return { inner: current, nullable };
}

function zodChecksToSql(fieldName: string, schema: z.ZodType): string[] {
	const checks: string[] = [];
	const withBounds = schema as {
		minValue?: number;
		maxValue?: number;
		minLength?: number;
		maxLength?: number;
		isInt?: boolean;
	};

	if (
		typeof withBounds.minValue === "number" &&
		Number.isFinite(withBounds.minValue)
	) {
		checks.push(`"${fieldName}" >= ${withBounds.minValue}`);
	}
	if (
		typeof withBounds.maxValue === "number" &&
		Number.isFinite(withBounds.maxValue)
	) {
		checks.push(`"${fieldName}" <= ${withBounds.maxValue}`);
	}
	if (typeof withBounds.minLength === "number") {
		checks.push(`char_length("${fieldName}") >= ${withBounds.minLength}`);
	}
	if (typeof withBounds.maxLength === "number") {
		checks.push(`char_length("${fieldName}") <= ${withBounds.maxLength}`);
	}

	const def = getZodDef(schema);
	const zodChecks = def?.checks ?? [];

	for (const check of zodChecks) {
		if (check.kind === "min" && typeof check.value === "number") {
			checks.push(`"${fieldName}" >= ${check.value}`);
		}
		if (check.kind === "max" && typeof check.value === "number") {
			checks.push(`"${fieldName}" <= ${check.value}`);
		}
		if (check.kind === "min_length" && typeof check.value === "number") {
			checks.push(`char_length("${fieldName}") >= ${check.value}`);
		}
		if (check.kind === "max_length" && typeof check.value === "number") {
			checks.push(`char_length("${fieldName}") <= ${check.value}`);
		}
	}

	return checks;
}

function zodToSqlType(schema: z.ZodType): string {
	const withFormat = schema as { isInt?: boolean; format?: string };
	if (withFormat.isInt || withFormat.format === "safeint") {
		return "integer";
	}

	const def = getZodDef(schema);
	const typeName = def?.type ?? def?.typeName;

	switch (typeName) {
		case "string":
			return "text";
		case "number":
			return "double precision";
		case "int":
		case "integer":
			return "integer";
		case "boolean":
			return "boolean";
		case "date":
			return "timestamptz";
		case "enum":
			return "text";
		case "array":
			return "jsonb";
		case "record":
		case "object":
			return "jsonb";
		case "uuid":
			return "uuid";
		default:
			return "jsonb";
	}
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

/** Compile one Zod object shape into a table definition. */
export function compileTableShape(input: {
	moduleId: string;
	tableName: string;
	shape: z.ZodObject<z.ZodRawShape>;
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
		const { inner, nullable } = unwrapOptional(fieldSchema as z.ZodType);
		const meta = readColumnMeta(fieldSchema);
		const checkConstraints = zodChecksToSql(fieldName, inner);

		columns.push({
			name: fieldName,
			sqlType: zodToSqlType(inner),
			nullable: nullable || meta.pk !== true,
			meta,
			checkConstraints,
		});

		if (meta.pk) {
			primaryKey.push(fieldName);
		}
		if (meta.unique) {
			uniqueConstraints.push([fieldName]);
		}
		if (meta.index && !meta.unique) {
			indexes.push([fieldName]);
		}
		if (meta.references) {
			const parsed = parseReference(input.moduleId, meta.references);
			foreignKeys.push({
				column: fieldName,
				referencedSchema: parsed.referencedSchema,
				referencedTable: parsed.referencedTable,
				referencedColumn: parsed.referencedColumn,
				onDelete: meta.references.onDelete ?? "no action",
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
		columns,
		primaryKey,
		uniqueConstraints,
		indexes,
		foreignKeys,
		excludeConstraints: input.excludes ?? [],
	};
}
