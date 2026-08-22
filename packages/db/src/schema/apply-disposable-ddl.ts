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
 * Split module DDL into executable statements. Handles:
 * - DO $$ ... END $$; blocks with internal semicolons
 * - Function bodies and other dollar-quoted strings (AS $$ ... $$;)
 *
 * Comment-only and blank lines outside a quote/block are skipped so a preceding
 * `-- Isolation: …` marker cannot prefix the next statement and cause it to be
 * dropped.
 */
export function splitModuleDdlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let inDoBlock = false;
	let inDollarQuote = false;

	for (const line of sql.split("\n")) {
		const trimmed = line.trim();

		if (
			!inDoBlock &&
			!inDollarQuote &&
			(trimmed === "" || trimmed.startsWith("--"))
		) {
			continue;
		}

		if (!inDollarQuote && trimmed.startsWith("DO $$")) {
			inDoBlock = true;
		}

		// Toggle dollar-quote state for every $$ delimiter on the line.
		// DO $$ blocks also use $$, but they close on END $$; via inDoBlock.
		const dollarCount = (line.match(/\$\$/g) ?? []).length;
		// Odd count toggles; even count returns to the prior state.
		if (!inDoBlock && dollarCount > 0 && dollarCount % 2 === 1) {
			inDollarQuote = !inDollarQuote;
		}

		current += `${line}\n`;

		if (inDoBlock) {
			if (trimmed === "END $$;" || trimmed.endsWith("END $$;")) {
				inDoBlock = false;
				inDollarQuote = false;
				const statement = current.trim();
				if (statement) {
					statements.push(statement);
				}
				current = "";
			}
			continue;
		}

		if (inDollarQuote) {
			continue;
		}

		if (trimmed.endsWith(";")) {
			const statement = current.trim();
			if (statement) {
				statements.push(statement);
			}
			current = "";
		}
	}

	const remainder = current.trim();
	if (remainder) {
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
		"0007_auth_cuid_defaults.sql",
	];
	for (const name of migrations) {
		if (
			name === "0004_command_grant_integrity.sql" ||
			name === "0005_module_outbox_integrity.sql" ||
			name === "0006_module_outbox_skip.sql" ||
			name === "0007_auth_cuid_defaults.sql"
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
