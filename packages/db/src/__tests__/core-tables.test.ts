import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const drizzleDir = join(import.meta.dirname, "../../drizzle");

function loadMigration(name: string): string[] {
	return readFileSync(join(drizzleDir, name), "utf8")
		.split("--> statement-breakpoint")
		.map((part) => part.trim())
		.filter(Boolean);
}

describe("core tables migration", () => {
	it("creates the four unread core tables on disposable Postgres", async () => {
		const db = new PGlite();
		for (const statement of loadMigration("0001_core_tables.sql")) {
			await db.exec(statement);
		}

		const tables = await db.query<{ tablename: string }>(
			`SELECT tablename FROM pg_tables WHERE schemaname = 'core' ORDER BY tablename`,
		);

		expect(tables.rows.map((row) => row.tablename)).toEqual([
			"module_config",
			"party",
			"subject",
			"transaction",
		]);
	});
});
