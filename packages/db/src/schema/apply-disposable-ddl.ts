import { readFileSync } from "node:fs";
import { join } from "node:path";

const drizzleDir = join(import.meta.dirname, "../../drizzle");

/** Load Drizzle migration statements split on statement breakpoints. */
export function loadCoreMigration(name = "0001_core_tables.sql"): string[] {
	return readFileSync(join(drizzleDir, name), "utf8")
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
