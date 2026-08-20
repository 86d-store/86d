import type { ColumnMeta } from "./col";
import { col } from "./col";
import { getZodDef } from "./compile/zod-inspect";
import type {
	ModuleStorageDeclaration,
	PublishedView,
	TableDeclaration,
} from "./declaration";

const STABLE_ID = /^[a-z][a-z0-9_]*$/;
const STABLE_SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export type StorageValidationIssue = Readonly<{
	code: string;
	message: string;
	path?: string;
}>;

export class StorageDeclarationError extends Error {
	readonly issues: readonly StorageValidationIssue[];

	constructor(issues: readonly StorageValidationIssue[]) {
		super(issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
		this.name = "StorageDeclarationError";
		this.issues = issues;
	}
}

function readColumnMeta(field: unknown): ColumnMeta {
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

function shapeColumnNames(
	shape: TableDeclaration["shape"],
): ReadonlySet<string> {
	return new Set(Object.keys(shape.shape));
}

function isForbiddenNoneField(
	storage: Record<string, unknown>,
): string | undefined {
	for (const key of [
		"config",
		"tables",
		"extends",
		"anchors",
		"publishes",
	] as const) {
		if (key in storage && storage[key] !== undefined) {
			return key;
		}
	}
	return undefined;
}

function isForbiddenConfigField(
	storage: Record<string, unknown>,
): string | undefined {
	for (const key of ["tables", "extends", "anchors", "publishes"] as const) {
		if (key in storage && storage[key] !== undefined) {
			return key;
		}
	}
	return undefined;
}

/**
 * Validate a Module storage declaration against the Module-system compiler rules.
 * Returns issues; does not throw.
 */
export function validateStorageDeclaration(
	moduleId: string,
	storage: ModuleStorageDeclaration | null | undefined,
): StorageValidationIssue[] {
	const issues: StorageValidationIssue[] = [];

	if (storage == null) {
		issues.push({
			code: "storage_required",
			message: `Module "${moduleId}" must declare storage`,
		});
		return issues;
	}

	const raw = storage as Record<string, unknown>;
	const kind = raw.kind;

	if (kind !== "none" && kind !== "config" && kind !== "relational") {
		issues.push({
			code: "storage_kind_invalid",
			message: `Module "${moduleId}" storage.kind must be none, config, or relational`,
			path: "kind",
		});
		return issues;
	}

	if (kind === "none") {
		const forbidden = isForbiddenNoneField(raw);
		if (forbidden) {
			issues.push({
				code: "storage_forbidden_field",
				message: `storage.kind "none" forbids field "${forbidden}"`,
				path: forbidden,
			});
		}
		return issues;
	}

	if (kind === "config") {
		const forbidden = isForbiddenConfigField(raw);
		if (forbidden) {
			issues.push({
				code: "storage_forbidden_field",
				message: `storage.kind "config" forbids field "${forbidden}"`,
				path: forbidden,
			});
		}
		const config = raw.config;
		if (
			!config ||
			typeof config !== "object" ||
			Object.keys(config as object).length === 0
		) {
			issues.push({
				code: "config_empty",
				message: `Module "${moduleId}" Config storage requires at least one config key`,
				path: "config",
			});
			return issues;
		}
		const seen = new Set<string>();
		for (const key of Object.keys(config as object)) {
			if (!STABLE_ID.test(key.replace(/\./g, "_"))) {
				// Allow dotted keys (settings-style) when normalized snake form is stable.
				const normalized = key.replace(/\./g, "_");
				if (!STABLE_ID.test(normalized)) {
					issues.push({
						code: "config_key_invalid",
						message: `Config key "${key}" must be a stable lower-snake identifier`,
						path: `config.${key}`,
					});
				}
			}
			const normalized = key.toLowerCase();
			if (seen.has(normalized)) {
				issues.push({
					code: "config_key_duplicate",
					message: `Duplicate normalized Config key "${key}"`,
					path: `config.${key}`,
				});
			}
			seen.add(normalized);
		}
		return issues;
	}

	// relational
	const tables = (raw.tables ?? {}) as Record<string, TableDeclaration>;
	const extendsMap = (raw.extends ?? {}) as Record<string, unknown>;
	const tableKeys = Object.keys(tables);
	const extendKeys = Object.keys(extendsMap);

	if (tableKeys.length === 0 && extendKeys.length === 0) {
		issues.push({
			code: "relational_empty",
			message: `Module "${moduleId}" Relational storage requires non-empty tables or extends`,
			path: "tables",
		});
	}

	const tableNameSet = new Set(tableKeys);
	const seenTableNorm = new Set<string>();
	for (const tableName of tableKeys) {
		if (
			!STABLE_ID.test(
				tableName
					.replace(/([A-Z])/g, "_$1")
					.toLowerCase()
					.replace(/^_/, ""),
			)
		) {
			// camelCase table names are allowed in declarations; physical names are derived.
		}
		const norm = tableName.toLowerCase();
		if (seenTableNorm.has(norm)) {
			issues.push({
				code: "table_name_duplicate",
				message: `Duplicate normalized table name "${tableName}"`,
				path: `tables.${tableName}`,
			});
		}
		seenTableNorm.add(norm);
	}

	const anchors = (raw.anchors ?? []) as readonly {
		table: string;
		column: string;
		kind: string;
	}[];
	for (const [index, anchor] of anchors.entries()) {
		if (!tableNameSet.has(anchor.table)) {
			issues.push({
				code: "anchor_unknown_table",
				message: `Anchor refers to undeclared table "${anchor.table}"`,
				path: `anchors[${index}].table`,
			});
			continue;
		}
		const declaration = tables[anchor.table];
		if (!declaration) continue;
		const columns = shapeColumnNames(declaration.shape);
		if (!columns.has(anchor.column)) {
			issues.push({
				code: "anchor_unknown_column",
				message: `Anchor column "${anchor.column}" is not on table "${anchor.table}"`,
				path: `anchors[${index}].column`,
			});
		}
	}

	const publishes = (raw.publishes ?? {}) as Record<string, PublishedView>;
	const seenPub = new Set<string>();
	for (const [viewName, view] of Object.entries(publishes)) {
		const norm = viewName.toLowerCase();
		if (seenPub.has(norm)) {
			issues.push({
				code: "publish_name_duplicate",
				message: `Duplicate normalized publish name "${viewName}"`,
				path: `publishes.${viewName}`,
			});
		}
		seenPub.add(norm);

		if (!view.version || !STABLE_SEMVER.test(view.version)) {
			issues.push({
				code: "publish_version_invalid",
				message: `Publish "${viewName}" requires StableSemVer version`,
				path: `publishes.${viewName}.version`,
			});
		}
		if (!tableNameSet.has(view.table)) {
			issues.push({
				code: "publish_unknown_table",
				message: `Publish "${viewName}" refers to undeclared table "${view.table}"`,
				path: `publishes.${viewName}.table`,
			});
			continue;
		}
		const declaration = tables[view.table];
		if (!declaration) continue;
		const columns = shapeColumnNames(declaration.shape);
		const shape = declaration.shape.shape;
		for (const column of view.columns) {
			if (!columns.has(column)) {
				issues.push({
					code: "publish_unknown_column",
					message: `Publish "${viewName}" column "${column}" is not on table "${view.table}"`,
					path: `publishes.${viewName}.columns`,
				});
				continue;
			}
			const meta = readColumnMeta(shape[column]);
			if (meta.sensitive) {
				issues.push({
					code: "publish_sensitive_column",
					message: `Publish "${viewName}" cannot include sensitive column "${column}"`,
					path: `publishes.${viewName}.columns`,
				});
			}
		}
	}

	if (raw.config && typeof raw.config === "object") {
		const configKeys = Object.keys(raw.config as object);
		if (configKeys.length === 0) {
			issues.push({
				code: "config_empty",
				message: `Module "${moduleId}" optional Relational config must be non-empty when present`,
				path: "config",
			});
		}
	}

	return issues;
}

/** Validate and throw on the first Module with invalid storage. */
export function assertValidStorageDeclaration(
	moduleId: string,
	storage: ModuleStorageDeclaration | null | undefined,
): asserts storage is ModuleStorageDeclaration {
	const issues = validateStorageDeclaration(moduleId, storage);
	if (issues.length > 0) {
		throw new StorageDeclarationError(issues);
	}
}
