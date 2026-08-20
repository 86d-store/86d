import type { Module } from "../types/module";
import type { CompiledTable, CompileModuleResult } from "./compile/types";
import type { ModuleStorageDeclaration } from "./declaration";
import {
	resolveModuleStorage,
	storageConfig,
	storageTables,
} from "./declaration";
import { assertValidStorageDeclaration } from "./storage-validate";

/** Default per-Module statement timeout (milliseconds). */
export const DEFAULT_MODULE_STATEMENT_TIMEOUT_MS = 5_000;

/** Login / store owner role names used in compiled isolation SQL. */
export const STORE_LOGIN_ROLE = "store_login";
export const STORE_OWNER_ROLE = "store_owner";

export type IsolationCompileOptions = Readonly<{
	statementTimeoutMs?: number;
	/** Modules that may SELECT a published view: consumerModuleId → publisher view grants */
	viewGrants?: Readonly<
		Record<string, readonly { publisherModuleId: string; viewName: string }[]>
	>;
}>;

export type CompiledIsolationArtifact = Readonly<{
	moduleId: string;
	roleName: string;
	schemaName: string;
	configKeys: readonly string[];
	publishedViews: readonly {
		viewName: string;
		schemaName: string;
		tableName: string;
		columns: readonly string[];
		version: string;
	}[];
	statementTimeoutMs: number;
}>;

function moduleRoleName(moduleId: string): string {
	return `mod_${moduleId.replace(/-/g, "_")}`;
}

function moduleSchemaName(moduleId: string): string {
	return `mod_${moduleId}`;
}

function configFunctionPrefix(moduleId: string): string {
	return `cfg_${moduleId.replace(/-/g, "_")}`;
}

function quoteIdent(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function sqlStringLiteral(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function physicalColumnName(logical: string): string {
	return logical
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/-/g, "_")
		.toLowerCase();
}

/**
 * Compile per-Module isolation identities: roles, schemas, Config SECURITY DEFINER
 * functions, published views, grants, revocations, and statement timeouts.
 */
export function compileIsolationArtifacts(
	modules: readonly Module[],
	options: IsolationCompileOptions = {},
): readonly CompiledIsolationArtifact[] {
	const timeout =
		options.statementTimeoutMs ?? DEFAULT_MODULE_STATEMENT_TIMEOUT_MS;
	const artifacts: CompiledIsolationArtifact[] = [];

	for (const module of modules) {
		const storage = resolveModuleStorage(module);
		assertValidStorageDeclaration(module.id, storage);

		if (storage.kind === "none") {
			continue;
		}

		const config = storageConfig(storage);
		const configKeys = Object.keys(config).sort((a, b) => a.localeCompare(b));
		const publishedViews: Array<{
			viewName: string;
			schemaName: string;
			tableName: string;
			columns: readonly string[];
			version: string;
		}> = [];

		if (storage.kind === "relational" && storage.publishes) {
			const tables = storageTables(storage);
			for (const [viewName, view] of Object.entries(storage.publishes)) {
				const table = tables[view.table];
				if (!table) continue;
				publishedViews.push({
					viewName,
					schemaName: moduleSchemaName(module.id),
					tableName: view.table,
					columns: view.columns.map(physicalColumnName),
					version: view.version,
				});
			}
		}

		artifacts.push({
			moduleId: module.id,
			roleName: moduleRoleName(module.id),
			schemaName: moduleSchemaName(module.id),
			configKeys,
			publishedViews,
			statementTimeoutMs: timeout,
		});
	}

	return artifacts;
}

function emitConfigFunctions(
	moduleId: string,
	configKeys: readonly string[],
): string[] {
	if (configKeys.length === 0) {
		return [];
	}

	const prefix = configFunctionPrefix(moduleId);
	const role = moduleRoleName(moduleId);
	const keyArray = configKeys.map(sqlStringLiteral).join(", ");
	const lines: string[] = [];

	const commonSettings = [
		"LANGUAGE plpgsql",
		"SECURITY DEFINER",
		"SET search_path = pg_catalog, core",
	];

	lines.push(`CREATE OR REPLACE FUNCTION core.${prefix}_get(p_key text)`);
	lines.push(`RETURNS jsonb`);
	lines.push(...commonSettings);
	lines.push(`AS $$`);
	lines.push(`DECLARE`);
	lines.push(`  allowed text[] := ARRAY[${keyArray}];`);
	lines.push(`  result jsonb;`);
	lines.push(`BEGIN`);
	lines.push(`  IF NOT (p_key = ANY (allowed)) THEN`);
	lines.push(
		`    RAISE EXCEPTION 'config key not allowed' USING ERRCODE = '42501';`,
	);
	lines.push(`  END IF;`);
	lines.push(`  SELECT value INTO result FROM core.module_config`);
	lines.push(
		`  WHERE module_id = ${sqlStringLiteral(moduleId)} AND key = p_key;`,
	);
	lines.push(`  RETURN result;`);
	lines.push(`END;`);
	lines.push(`$$;`);
	lines.push("");

	lines.push(
		`CREATE OR REPLACE FUNCTION core.${prefix}_upsert(p_key text, p_value jsonb)`,
	);
	lines.push(`RETURNS void`);
	lines.push(...commonSettings);
	lines.push(`AS $$`);
	lines.push(`DECLARE`);
	lines.push(`  allowed text[] := ARRAY[${keyArray}];`);
	lines.push(`BEGIN`);
	lines.push(`  IF NOT (p_key = ANY (allowed)) THEN`);
	lines.push(
		`    RAISE EXCEPTION 'config key not allowed' USING ERRCODE = '42501';`,
	);
	lines.push(`  END IF;`);
	lines.push(`  INSERT INTO core.module_config (module_id, key, value)`);
	lines.push(`  VALUES (${sqlStringLiteral(moduleId)}, p_key, p_value)`);
	lines.push(`  ON CONFLICT (module_id, key) DO UPDATE`);
	lines.push(`  SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;`);
	lines.push(`END;`);
	lines.push(`$$;`);
	lines.push("");

	lines.push(`CREATE OR REPLACE FUNCTION core.${prefix}_delete(p_key text)`);
	lines.push(`RETURNS void`);
	lines.push(...commonSettings);
	lines.push(`AS $$`);
	lines.push(`DECLARE`);
	lines.push(`  allowed text[] := ARRAY[${keyArray}];`);
	lines.push(`BEGIN`);
	lines.push(`  IF NOT (p_key = ANY (allowed)) THEN`);
	lines.push(
		`    RAISE EXCEPTION 'config key not allowed' USING ERRCODE = '42501';`,
	);
	lines.push(`  END IF;`);
	lines.push(`  DELETE FROM core.module_config`);
	lines.push(
		`  WHERE module_id = ${sqlStringLiteral(moduleId)} AND key = p_key;`,
	);
	lines.push(`END;`);
	lines.push(`$$;`);
	lines.push("");

	lines.push(`REVOKE ALL ON FUNCTION core.${prefix}_get(text) FROM PUBLIC;`);
	lines.push(
		`REVOKE ALL ON FUNCTION core.${prefix}_upsert(text, jsonb) FROM PUBLIC;`,
	);
	lines.push(`REVOKE ALL ON FUNCTION core.${prefix}_delete(text) FROM PUBLIC;`);
	lines.push(
		`GRANT EXECUTE ON FUNCTION core.${prefix}_get(text) TO ${quoteIdent(role)};`,
	);
	lines.push(
		`GRANT EXECUTE ON FUNCTION core.${prefix}_upsert(text, jsonb) TO ${quoteIdent(role)};`,
	);
	lines.push(
		`GRANT EXECUTE ON FUNCTION core.${prefix}_delete(text) TO ${quoteIdent(role)};`,
	);
	lines.push("");

	return lines;
}

function emitPublishedViews(
	artifact: CompiledIsolationArtifact,
	compiledTables: readonly CompiledTable[],
): string[] {
	const lines: string[] = [];
	lines.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent("pub")};`);

	for (const view of artifact.publishedViews) {
		const physicalTable =
			compiledTables.find((t) => t.tableName === view.tableName) ??
			compiledTables.find(
				(t) => t.tableName === physicalColumnName(view.tableName),
			);
		const tableName =
			physicalTable?.tableName ?? physicalColumnName(view.tableName);
		const cols = view.columns.map((c) => quoteIdent(c)).join(", ");
		const viewIdent = `${artifact.moduleId.replace(/-/g, "_")}__${view.viewName.replace(/-/g, "_")}`;
		lines.push(
			`CREATE OR REPLACE VIEW ${quoteIdent("pub")}.${quoteIdent(viewIdent)} AS`,
		);
		lines.push(
			`  SELECT ${cols} FROM ${quoteIdent(view.schemaName)}.${quoteIdent(tableName)};`,
		);
		lines.push(
			`ALTER VIEW ${quoteIdent("pub")}.${quoteIdent(viewIdent)} OWNER TO ${quoteIdent(STORE_OWNER_ROLE)};`,
		);
		lines.push("");
	}

	return lines;
}

/**
 * Emit isolation DDL for roles, Config functions, views, grants, and timeouts.
 * Table DDL is emitted separately by `emitSql`.
 */
export function emitIsolationSql(
	artifacts: readonly CompiledIsolationArtifact[],
	compiledModules: readonly CompileModuleResult[] = [],
	options: IsolationCompileOptions = {},
): string {
	const lines: string[] = [];
	const compiledByModule = new Map(
		compiledModules.map((m) => [m.moduleId, m.tables] as const),
	);

	lines.push(`-- Store isolation bootstrap`);
	lines.push(
		`DO $$ BEGIN CREATE ROLE ${quoteIdent(STORE_OWNER_ROLE)}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
	);
	lines.push(
		`DO $$ BEGIN CREATE ROLE ${quoteIdent(STORE_LOGIN_ROLE)} NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
	);
	lines.push(
		`REVOKE ALL ON SCHEMA public FROM ${quoteIdent(STORE_LOGIN_ROLE)};`,
	);
	lines.push(`REVOKE ALL ON SCHEMA core FROM ${quoteIdent(STORE_LOGIN_ROLE)};`);
	lines.push("");

	for (const artifact of artifacts) {
		lines.push(`-- Isolation: ${artifact.moduleId}`);
		lines.push(
			`DO $$ BEGIN CREATE ROLE ${quoteIdent(artifact.roleName)} NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
		);
		lines.push(
			`ALTER ROLE ${quoteIdent(artifact.roleName)} SET statement_timeout = ${artifact.statementTimeoutMs};`,
		);
		lines.push(
			`GRANT ${quoteIdent(artifact.roleName)} TO ${quoteIdent(STORE_LOGIN_ROLE)};`,
		);

		if (
			artifact.configKeys.length > 0 ||
			(compiledByModule.get(artifact.moduleId)?.length ?? 0) > 0
		) {
			lines.push(
				`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(artifact.schemaName)};`,
			);
			lines.push(
				`REVOKE ALL ON SCHEMA ${quoteIdent(artifact.schemaName)} FROM PUBLIC;`,
			);
			lines.push(
				`REVOKE ALL ON SCHEMA ${quoteIdent(artifact.schemaName)} FROM ${quoteIdent(STORE_LOGIN_ROLE)};`,
			);
			lines.push(
				`GRANT USAGE ON SCHEMA ${quoteIdent(artifact.schemaName)} TO ${quoteIdent(artifact.roleName)};`,
			);
			lines.push(
				`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${quoteIdent(artifact.schemaName)} TO ${quoteIdent(artifact.roleName)};`,
			);
			lines.push(
				`ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(artifact.schemaName)} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdent(artifact.roleName)};`,
			);
		}

		lines.push(...emitConfigFunctions(artifact.moduleId, artifact.configKeys));

		const tables = compiledByModule.get(artifact.moduleId) ?? [];
		lines.push(...emitPublishedViews(artifact, tables));

		// No base-table privilege on core.module_config for Module roles.
		lines.push(
			`REVOKE ALL ON TABLE core.module_config FROM ${quoteIdent(artifact.roleName)};`,
		);
		lines.push("");
	}

	// View SELECT grants to consuming Module roles.
	const viewGrants = options.viewGrants ?? {};
	for (const [consumerId, grants] of Object.entries(viewGrants)) {
		const consumerRole = moduleRoleName(consumerId);
		for (const grant of grants) {
			const viewIdent = `${grant.publisherModuleId.replace(/-/g, "_")}__${grant.viewName.replace(/-/g, "_")}`;
			lines.push(
				`GRANT SELECT ON ${quoteIdent("pub")}.${quoteIdent(viewIdent)} TO ${quoteIdent(consumerRole)};`,
			);
			// Consumers must not receive USAGE on publisher mod_* schemas.
			lines.push(
				`REVOKE ALL ON SCHEMA ${quoteIdent(moduleSchemaName(grant.publisherModuleId))} FROM ${quoteIdent(consumerRole)};`,
			);
		}
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

/** Resolve storage for compilation helpers. */
export function moduleStorageOrThrow(module: Module): ModuleStorageDeclaration {
	const storage = resolveModuleStorage(module);
	assertValidStorageDeclaration(module.id, storage);
	return storage;
}
