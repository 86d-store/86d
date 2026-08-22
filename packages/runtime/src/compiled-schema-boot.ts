import type { CompileModuleResult } from "@86d-app/core/schema";
import {
	compileModuleDeclarations,
	emitSql,
} from "@86d-app/core/schema/compile";
import type { Module } from "@86d-app/core/types/module";
import {
	applyModuleDdl,
	type SqlExecutor,
} from "db/schema/apply-disposable-ddl";

export type CompiledSchemaBundle = Readonly<{
	compiled: readonly CompileModuleResult[];
	sql: string;
}>;

/** Compile installed Modules to DDL + table metadata for boot. */
export function compileInstalledModules(
	modules: readonly Module[],
): CompiledSchemaBundle {
	const report = compileModuleDeclarations([...modules]);
	const compiled = report.transcoded;
	const sql = emitSql(compiled);
	return { compiled, sql };
}

/** Apply compiled Module DDL idempotently against the Store database. */
export async function applyCompiledModuleSchema(
	executor: SqlExecutor,
	bundle: CompiledSchemaBundle,
): Promise<void> {
	if (bundle.sql.trim().length === 0) {
		return;
	}
	await applyModuleDdl(executor, bundle.sql);
}

export function compiledForModule(
	bundle: CompiledSchemaBundle,
	moduleId: string,
): readonly CompileModuleResult[] {
	return bundle.compiled.filter((entry) => entry.moduleId === moduleId);
}
