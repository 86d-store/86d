/**
 * One-shot converter: legacy ModuleSchema → native Zod storage declarations.
 * Run: bun scripts/convert-module-storage.ts
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MODULES_ROOT = join(import.meta.dir, "../modules");

type FieldAttribute = {
	type?: unknown;
	required?: boolean;
	unique?: boolean;
	index?: boolean;
	defaultValue?: unknown;
	onUpdate?: unknown;
	references?: {
		model: string;
		field: string;
		onDelete?: string;
	};
};

type EntitySchema = { fields?: Record<string, FieldAttribute> };
type ModuleSchema = Record<string, EntitySchema>;

function indent(level: number): string {
	return "\t".repeat(level);
}

function serializeDefault(value: unknown): string {
	if (typeof value === "function") {
		const src = Function.prototype.toString.call(value);
		if (src.includes("new Date")) {
			return "() => new Date()";
		}
		if (src.includes("return {}") || src.includes("=> ({})") || src.includes("=> ({ })")) {
			return "() => ({})";
		}
		if (src.includes("return []") || src.includes("=> []")) {
			return "() => []";
		}
		// Fallback: try to evaluate common numeric/string literals from source
		const arrowMatch = src.match(/=>\s*(.+)$/);
		if (arrowMatch) {
			return arrowMatch[1].trim();
		}
		return "undefined";
	}
	return JSON.stringify(value);
}

function fieldToZodSource(fieldName: string, field: FieldAttribute): string {
	const required = field.required !== false;
	const parts: string[] = [];

	if (field.type === "string[]") {
		parts.push("z.array(z.string())");
	} else if (field.type === "number[]") {
		parts.push("z.array(z.number())");
	} else if (Array.isArray(field.type)) {
		const values = field.type as string[];
		if (values.length === 0) {
			parts.push("z.string()");
		} else {
			parts.push(
				`z.enum([${values.map((v) => JSON.stringify(v)).join(", ")}])`,
			);
		}
	} else {
		switch (field.type) {
			case "string":
				parts.push("z.string()");
				break;
			case "number":
				parts.push(
					Number.isInteger(field.defaultValue as number | undefined)
						? "z.int()"
						: "z.number()",
				);
				break;
			case "boolean":
				parts.push("z.boolean()");
				break;
			case "date":
				parts.push("z.coerce.date()");
				break;
			case "json":
				parts.push("z.record(z.string(), z.unknown())");
				break;
			default:
				parts.push("z.string()");
		}
	}

	const metaEntries: string[] = [];
	if (fieldName === "id") metaEntries.push("pk: true");
	if (field.unique) metaEntries.push("unique: true");
	if (field.index) metaEntries.push("index: true");
	if (field.references) {
		const onDelete = field.references.onDelete;
		const onDeletePart = onDelete
			? `, onDelete: ${JSON.stringify(
					onDelete === "no action"
						? "no action"
						: onDelete === "set null"
							? "set null"
							: onDelete === "restrict"
								? "restrict"
								: "cascade",
				)}`
			: "";
		metaEntries.push(
			`references: { table: ${JSON.stringify(`self.${field.references.model}`)}, column: ${JSON.stringify(field.references.field)}${onDeletePart} }`,
		);
	}

	let expr = parts[0];
	if (metaEntries.length > 0) {
		expr += `.register(col, { ${metaEntries.join(", ")} })`;
	}

	if (field.defaultValue !== undefined) {
		const def = serializeDefault(field.defaultValue);
		if (def !== "undefined") {
			expr += `.default(${def})`;
		} else if (!required) {
			expr += ".optional()";
		}
	} else if (!required) {
		expr += ".optional()";
	}

	return expr;
}

function schemaToStorageSource(
	moduleId: string,
	exportPrefix: string,
	schema: ModuleSchema,
): string {
	const entities = Object.entries(schema).filter(
		([, entity]) => entity.fields && Object.keys(entity.fields).length > 0,
	);

	if (entities.length === 0) {
		return `import type { ModuleStorageDeclaration } from "@86d-app/core/schema";

/** ${moduleId} owns no durable storage. */
export const ${exportPrefix}Storage = {
	kind: "none",
} as const satisfies ModuleStorageDeclaration;
`;
	}

	const shapeBlocks: string[] = [];
	const tableEntries: string[] = [];

	for (const [entityName, entity] of entities) {
		const shapeName = `${exportPrefix}${entityName[0].toUpperCase()}${entityName.slice(1)}Shape`;
		const fieldLines = Object.entries(entity.fields ?? {}).map(
			([fieldName, field]) =>
				`${indent(1)}${fieldName}: ${fieldToZodSource(fieldName, field)},`,
		);
		shapeBlocks.push(
			`export const ${shapeName} = z.object({\n${fieldLines.join("\n")}\n});\n`,
		);
		tableEntries.push(
			`${indent(2)}${entityName}: {\n${indent(3)}shape: ${shapeName},\n${indent(2)}},`,
		);
	}

	return `import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

${shapeBlocks.join("\n")}
/** Native Relational storage for ${moduleId}. */
export const ${exportPrefix}Storage = {
	kind: "relational",
	tables: {
${tableEntries.join("\n")}
	},
} as const satisfies ModuleStorageDeclaration;
`;
}

function camelPrefix(moduleId: string): string {
	return moduleId
		.split("-")
		.map((part, index) =>
			index === 0 ? part : part[0].toUpperCase() + part.slice(1),
		)
		.join("");
}

function extractSchemaObject(source: string): ModuleSchema | null {
	// Evaluate schema by stripping imports/exports and TypeScript-only syntax.
	const withoutImports = source
		.replace(/^import[\s\S]*?;\s*/gm, "")
		.replace(/export const \w+Tables[\s\S]*$/m, "")
		.replace(/satisfies ModuleSchema/g, "")
		.replace(/ as const/g, "")
		.replace(/validator:\s*\{[\s\S]*?\},?\n/g, "")
		.replace(/\/\*\*[\s\S]*?\*\//g, "")
		.replace(/export const (\w+) =/, "const __schema =");

	if (!withoutImports.includes("__schema")) {
		return null;
	}

	try {
		// biome-ignore lint/security/noGlobalEval: one-shot codegen over trusted module sources
		const fn = new Function(`${withoutImports}\nreturn __schema;`);
		return fn() as ModuleSchema;
	} catch (error) {
		console.error("Failed to eval schema:", error);
		return null;
	}
}

function updateIndex(
	indexPath: string,
	moduleId: string,
	prefix: string,
	kind: "none" | "relational",
): void {
	let source = readFileSync(indexPath, "utf8");

	// Remove schema/tables imports; add storage import
	source = source.replace(
		/import\s*\{[^}]*\}\s*from\s*["']\.\/schema["'];?\n?/g,
		"",
	);

	if (!source.includes(`${prefix}Storage`)) {
		const insertAfter = source.indexOf("from ");
		// Add import near other local imports
		const lastLocalImport = [...source.matchAll(/import .+ from "\.\/.+";\n/g)].pop();
		const storageImport = `import { ${prefix}Storage } from "./schema";\n`;
		if (lastLocalImport) {
			const idx = (lastLocalImport.index ?? 0) + lastLocalImport[0].length;
			source = source.slice(0, idx) + storageImport + source.slice(idx);
		} else {
			source = storageImport + source;
		}
	}

	// Replace schema: / tables: lines with storage:
	source = source.replace(/\n\t\tschema:\s*\w+,/g, "");
	source = source.replace(/\n\t\ttables:\s*\w+,/g, "");

	if (!source.includes("storage:")) {
		source = source.replace(
			/(version:\s*["'][^"']+["'],)/,
			`$1\n\t\tstorage: ${prefix}Storage,`,
		);
	}

	writeFileSync(indexPath, source);
	void kind;
	void moduleId;
}

function convertModule(moduleId: string): {
	kind: "none" | "relational";
	ok: boolean;
	error?: string;
} {
	const dir = join(MODULES_ROOT, moduleId, "src");
	const schemaPath = join(dir, "schema.ts");
	const indexPath = join(dir, "index.ts");
	const prefix = camelPrefix(moduleId);

	if (!existsSync(indexPath)) {
		return { kind: "none", ok: false, error: "no index" };
	}

	if (!existsSync(schemaPath)) {
		// Payment-style modules with inline schema: {}
		let index = readFileSync(indexPath, "utf8");
		if (!index.includes("storage:")) {
			const storageDecl = `
const ${prefix}Storage = { kind: "none" } as const;
`;
			if (!index.includes(`${prefix}Storage`)) {
				index = index.replace(
					/export default function/,
					`${storageDecl}\nexport default function`,
				);
			}
			index = index.replace(/\n\t\tschema:\s*\{\},/g, "");
			index = index.replace(
				/(version:\s*["'][^"']+["'],)/,
				`$1\n\t\tstorage: ${prefix}Storage,`,
			);
			writeFileSync(indexPath, index);
		}
		return { kind: "none", ok: true };
	}

	const schemaSource = readFileSync(schemaPath, "utf8");

	// Empty schema object
	if (
		/export const \w+Schema = \{\s*\}/.test(schemaSource) ||
		/export const \w+ = \{\s*\} satisfies ModuleSchema/.test(schemaSource)
	) {
		const noneSource = `import type { ModuleStorageDeclaration } from "@86d-app/core/schema";

export const ${prefix}Storage = {
	kind: "none",
} as const satisfies ModuleStorageDeclaration;
`;
		writeFileSync(schemaPath, noneSource);
		updateIndex(indexPath, moduleId, prefix, "none");
		return { kind: "none", ok: true };
	}

	const schema = extractSchemaObject(schemaSource);
	if (!schema) {
		return { kind: "relational", ok: false, error: "parse failed" };
	}

	const entities = Object.entries(schema).filter(
		([, e]) => e.fields && Object.keys(e.fields).length > 0,
	);
	if (entities.length === 0) {
		const noneSource = `import type { ModuleStorageDeclaration } from "@86d-app/core/schema";

export const ${prefix}Storage = {
	kind: "none",
} as const satisfies ModuleStorageDeclaration;
`;
		writeFileSync(schemaPath, noneSource);
		updateIndex(indexPath, moduleId, prefix, "none");
		return { kind: "none", ok: true };
	}

	const generated = schemaToStorageSource(moduleId, prefix, schema);
	writeFileSync(schemaPath, generated);
	updateIndex(indexPath, moduleId, prefix, "relational");
	return { kind: "relational", ok: true };
}

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySet = onlyArg
	? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean))
	: null;

const modules = readdirSync(MODULES_ROOT).filter((name) => {
	if (name === "README.md") return false;
	if (onlySet && !onlySet.has(name)) return false;
	return existsSync(join(MODULES_ROOT, name, "src", "index.ts"));
});

const classification: {
	moduleId: string;
	kind: "none" | "config" | "relational";
	ok: boolean;
	error?: string;
}[] = [];

for (const moduleId of modules.sort()) {
	const result = convertModule(moduleId);
	classification.push({
		moduleId,
		kind: result.kind,
		ok: result.ok,
		...(result.error ? { error: result.error } : {}),
	});
	console.log(
		`${result.ok ? "OK" : "FAIL"} ${moduleId} → ${result.kind}${result.error ? ` (${result.error})` : ""}`,
	);
}

const outPath = join(import.meta.dir, "../artifacts/module-storage-classification.json");
writeFileSync(
	outPath,
	`${JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			registryCount: classification.length,
			byKind: {
				none: classification.filter((c) => c.kind === "none").length,
				config: classification.filter((c) => c.kind === "config").length,
				relational: classification.filter((c) => c.kind === "relational")
					.length,
			},
			modules: classification,
		},
		null,
		2,
	)}\n`,
);

console.log(`\nWrote ${outPath}`);
console.log(
	`Totals: ${classification.length} modules, failures: ${classification.filter((c) => !c.ok).length}`,
);
