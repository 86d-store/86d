import type { Module } from "../../types/module";
import type { z } from "../../zod";
import { resolveModuleStorage, storageTables } from "../declaration";
import { readColumnMeta } from "./types";
import {
	classifyZodBase,
	getZodDef,
	readEnumValues,
	readFiniteChecks,
	unwrapFieldWrappers,
} from "./zod-inspect";

export type ConstructProvenance = Readonly<{
	moduleId: string;
	tableName?: string;
	fieldName?: string;
}>;

export type FeatureManifestEntry = Readonly<{
	/** Stable construct identity used as the support-boundary key. */
	id: string;
	kind: string;
	provenance: readonly ConstructProvenance[];
}>;

export type FeatureManifest = Readonly<{
	entries: readonly FeatureManifestEntry[];
	generatedAt: string;
}>;

function addConstruct(
	bucket: Map<string, ConstructProvenance[]>,
	id: string,
	provenance: ConstructProvenance,
): void {
	const list = bucket.get(id) ?? [];
	list.push(provenance);
	bucket.set(id, list);
}

function inventoryField(options: {
	bucket: Map<string, ConstructProvenance[]>;
	moduleId: string;
	tableName: string;
	fieldName: string;
	fieldSchema: z.ZodType;
}): void {
	const { bucket, moduleId, tableName, fieldName, fieldSchema } = options;
	const provenance = { moduleId, tableName, fieldName };
	const wrappers = unwrapFieldWrappers(fieldSchema);

	if (wrappers.optional) {
		addConstruct(bucket, "wrapper.optional", provenance);
	}
	if (wrappers.nullable) {
		addConstruct(bucket, "wrapper.nullable", provenance);
	}
	if (wrappers.hasDefault) {
		addConstruct(bucket, "wrapper.default", provenance);
		addConstruct(bucket, "default.value", provenance);
	}

	const base = classifyZodBase(wrappers.inner);
	if (base === "unknown") {
		addConstruct(bucket, "zod.unknown", provenance);
	} else {
		addConstruct(bucket, `zod.${base}`, provenance);
	}

	if (base === "enum") {
		const values = readEnumValues(wrappers.inner);
		if (values && values.length > 0) {
			addConstruct(bucket, "zod.enum.values", provenance);
		}
	}

	const checks = readFiniteChecks(wrappers.inner);
	if (checks.minValue !== undefined) {
		addConstruct(bucket, "check.min", provenance);
	}
	if (checks.maxValue !== undefined) {
		addConstruct(bucket, "check.max", provenance);
	}
	if (checks.minLength !== undefined) {
		addConstruct(bucket, "check.min_length", provenance);
	}
	if (checks.maxLength !== undefined) {
		addConstruct(bucket, "check.max_length", provenance);
	}

	const meta = readColumnMeta(fieldSchema);
	if (meta.pk) {
		addConstruct(bucket, "meta.pk", provenance);
	}
	if (meta.index) {
		addConstruct(bucket, "meta.index", provenance);
	}
	if (meta.unique) {
		addConstruct(bucket, "meta.unique", provenance);
	}
	if (meta.sensitive) {
		addConstruct(bucket, "meta.sensitive", provenance);
	}
	if (meta.anchor) {
		addConstruct(bucket, "meta.anchor", provenance);
	}
	if (meta.references) {
		const onDelete = meta.references.onDelete ?? "no action";
		addConstruct(bucket, `meta.references.${onDelete}`, provenance);
		const scope = meta.references.table.split(".")[0] ?? "raw";
		addConstruct(bucket, `meta.references.table.${scope}`, provenance);
	}
	if (meta.excludes && meta.excludes.length > 0) {
		addConstruct(bucket, "meta.excludes", provenance);
	}
}

/**
 * Walk installed Modules that declare Relational tables and emit the compiler
 * support-boundary inventory with Module/table/field provenance.
 */
export function buildFeatureManifest(
	modules: readonly Module[],
): FeatureManifest {
	const bucket = new Map<string, ConstructProvenance[]>();

	for (const module of modules) {
		const storage = resolveModuleStorage(module);
		const tables = storage ? storageTables(storage) : (module.tables ?? {});
		if (!tables || Object.keys(tables).length === 0) {
			const isNone =
				storage?.kind === "none" ||
				(!storage &&
					(!module.schema || Object.keys(module.schema).length === 0));
			if (isNone || storage?.kind === "config") {
				addConstruct(bucket, "module.tier_none", {
					moduleId: module.id,
				});
			}
			continue;
		}

		for (const [tableName, declaration] of Object.entries(tables)) {
			if (declaration.excludes && declaration.excludes.length > 0) {
				addConstruct(bucket, "table.exclude", {
					moduleId: module.id,
					tableName,
				});
			}
			const shape = declaration.shape.shape;
			for (const [fieldName, fieldSchema] of Object.entries(shape)) {
				inventoryField(
					bucket,
					module.id,
					tableName,
					fieldName,
					fieldSchema as z.ZodType,
				);
			}
		}
	}

	const entries: FeatureManifestEntry[] = [...bucket.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([id, provenance]) => ({
			id,
			kind: id.split(".")[0] ?? id,
			provenance,
		}));

	return {
		entries,
		generatedAt: new Date().toISOString(),
	};
}

/** Detect whether a field schema still contains an unsupported construct. */
export function findUnsupportedConstruct(
	fieldSchema: z.ZodType,
): string | undefined {
	const wrappers = unwrapFieldWrappers(fieldSchema);
	let current: unknown = wrappers.inner;
	const seen = new Set<unknown>();

	while (current && typeof current === "object" && !seen.has(current)) {
		seen.add(current);
		const base = classifyZodBase(current as z.ZodType);
		const supported = new Set([
			"string",
			"uuid",
			"number",
			"int",
			"integer",
			"boolean",
			"date",
			"date.coerce",
			"enum",
			"array",
			"record",
			"object",
		]);
		if (!supported.has(base)) {
			return base;
		}
		const def = getZodDef(current);
		if (def?.element) {
			current = def.element;
			continue;
		}
		if (def?.valueType) {
			current = def.valueType;
			continue;
		}
		break;
	}
	return undefined;
}
