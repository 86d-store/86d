import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(): string {
	const here =
		typeof import.meta.dirname === "string"
			? import.meta.dirname
			: dirname(fileURLToPath(import.meta.url));
	return join(here, "../..");
}

function drizzleDir(): string {
	return join(packageRoot(), "drizzle");
}

function initSqlPath(): string {
	return join(packageRoot(), "../../internals/docker/init.sql");
}

/** Load Drizzle migration statements split on statement breakpoints. */
export function loadCoreMigration(name = "0001_core_tables.sql"): string[] {
	return readFileSync(join(drizzleDir(), name), "utf8")
		.split("--> statement-breakpoint")
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * Split module DDL into executable statements. Handles DO $$ ... END $$; blocks
 * that contain internal semicolons.
 */
export function splitModuleDdlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let inDoBlock = false;

	for (const line of sql.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("DO $$")) {
			inDoBlock = true;
		}

		current += `${line}\n`;

		if (inDoBlock) {
			if (trimmed === "END $$;" || trimmed.endsWith("END $$;")) {
				inDoBlock = false;
				const statement = current.trim();
				if (statement && !statement.startsWith("--")) {
					statements.push(statement);
				}
				current = "";
			}
			continue;
		}

		if (trimmed.endsWith(";") && !trimmed.startsWith("--")) {
			const statement = current.trim();
			if (statement && !statement.startsWith("--")) {
				statements.push(statement);
			}
			current = "";
		}
	}

	const remainder = current.trim();
	if (remainder && !remainder.startsWith("--")) {
		statements.push(remainder);
	}

	return statements;
}

export type SqlExecutor = Readonly<{
	exec(statement: string): Promise<void>;
}>;

/** Apply compiled module DDL (from emitSql) to a disposable database. */
export async function applyModuleDdl(
	executor: SqlExecutor,
	sql: string,
): Promise<void> {
	for (const statement of splitModuleDdlStatements(sql)) {
		await executor.exec(statement);
	}
}

/** Apply ordered framework Drizzle migrations (baseline through current). */
export async function applyFrameworkMigrations(
	executor: SqlExecutor,
): Promise<void> {
	await executor.exec(readFileSync(initSqlPath(), "utf8"));
	const migrations = [
		"0000_baseline.sql",
		"0001_core_tables.sql",
		"0002_drop_module_data.sql",
		"0003_core_money_invariant.sql",
		"0004_command_grant_integrity.sql",
		"0005_module_outbox_integrity.sql",
		"0006_module_outbox_skip.sql",
	];
	for (const name of migrations) {
		if (
			name === "0004_command_grant_integrity.sql" ||
			name === "0005_module_outbox_integrity.sql" ||
			name === "0006_module_outbox_skip.sql"
		) {
			await executor.exec(readFileSync(join(drizzleDir(), name), "utf8"));
			continue;
		}
		for (const statement of loadCoreMigration(name)) {
			await executor.exec(statement);
		}
	}
}

/** Apply core migration then module DDL; safe to call twice on disposable Postgres. */
export async function applyDisposableDdl(
	executor: SqlExecutor,
	options: Readonly<{ moduleSql?: string }> = {},
): Promise<void> {
	for (const statement of loadCoreMigration()) {
		await executor.exec(statement);
	}
	if (options.moduleSql) {
		await applyModuleDdl(executor, options.moduleSql);
	}
}
