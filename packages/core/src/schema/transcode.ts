import type { FieldAttribute, ModuleSchema } from "../types/schema";
import { z } from "../zod";
import { col } from "./col";
import type { TableDeclaration } from "./declaration";

function normalizeDefault(value: unknown): unknown {
	if (typeof value === "function") {
		return value;
	}
	return value;
}

function fieldToZod(fieldName: string, field: FieldAttribute): z.ZodType {
	const required = field.required !== false;

	let schema: z.ZodType;

	if (field.type === "string[]") {
		schema = z.array(z.string());
	} else if (field.type === "number[]") {
		schema = z.array(z.number());
	} else {
		switch (field.type) {
			case "string":
				schema = z.string();
				break;
			case "number":
				schema = Number.isInteger(field.defaultValue as number | undefined)
					? z.int()
					: z.number();
				break;
			case "boolean":
				schema = z.boolean();
				break;
			case "date":
				schema = z.coerce.date();
				break;
			case "json":
				schema = z.record(z.string(), z.unknown());
				break;
			default:
				if (Array.isArray(field.type)) {
					const values = field.type as readonly string[];
					if (values.length === 0) {
						schema = z.string();
					} else {
						schema = z.enum(values as [string, ...string[]]);
					}
				} else {
					schema = z.string();
				}
		}
	}

	const meta: {
		pk?: boolean;
		index?: boolean;
		unique?: boolean;
		references?: {
			table: string;
			column: string;
			onDelete?: "restrict" | "cascade" | "set null" | "no action";
		};
	} = {};

	if (fieldName === "id") {
		meta.pk = true;
	}
	if (field.unique) {
		meta.unique = true;
	}
	if (field.index) {
		meta.index = true;
	}
	if (field.references) {
		const onDelete = field.references.onDelete;
		meta.references = {
			table: `self.${field.references.model}`,
			column: field.references.field,
			...(onDelete
				? {
						onDelete:
							onDelete === "no action"
								? "no action"
								: onDelete === "set null"
									? "set null"
									: onDelete === "restrict"
										? "restrict"
										: "cascade",
					}
				: {}),
		};
	}

	const hasMeta = Object.keys(meta).length > 0;
	if (hasMeta) {
		schema = schema.register(col, meta);
	}

	if (field.defaultValue !== undefined) {
		const defaultValue = normalizeDefault(field.defaultValue);
		schema = schema.default(defaultValue as never) as z.ZodType;
	} else if (!required) {
		schema = schema.optional();
	}

	return schema;
}

/**
 * Transcode a legacy `ModuleSchema` field map into Zod + `col` table declarations.
 * Does not invent constraints the field map never stated.
 */
export function transcodeModuleSchema(
	schema: ModuleSchema,
): Readonly<Record<string, TableDeclaration>> {
	const tables: Record<string, TableDeclaration> = {};

	for (const [entityName, entity] of Object.entries(schema)) {
		if (!entity.fields || Object.keys(entity.fields).length === 0) {
			continue;
		}

		const shapeEntries: Record<string, z.ZodType> = {};
		for (const [fieldName, field] of Object.entries(entity.fields)) {
			shapeEntries[fieldName] = fieldToZod(fieldName, field);
		}

		tables[entityName] = {
			shape: z.object(shapeEntries),
		};
	}

	return tables;
}
