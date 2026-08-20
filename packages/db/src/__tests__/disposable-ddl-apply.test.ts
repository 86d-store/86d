import { compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { loadCuratedModules } from "../load-curated-modules";
import { applyDisposableDdl } from "../schema/apply-disposable-ddl";

describe("disposable DDL apply", () => {
	it("applies core and curated module DDL twice without error", async () => {
		const modules = await loadCuratedModules();
		const report = compileModuleDeclarations(modules);
		const moduleSql = emitSql(report.transcoded);

		const db = new PGlite();
		const executor = {
			async exec(statement: string) {
				await db.exec(statement);
			},
		};

		await applyDisposableDdl(executor, { moduleSql });
		await applyDisposableDdl(executor, { moduleSql });

		const coreTables = await db.query<{ tablename: string }>(
			`SELECT tablename FROM pg_tables WHERE schemaname = 'core' ORDER BY tablename`,
		);
		expect(coreTables.rows.map((row) => row.tablename)).toEqual([
			"module_config",
			"party",
			"subject",
			"transaction",
		]);

		const modTables = await db.query<{ schemaname: string; tablename: string }>(
			`SELECT schemaname, tablename FROM pg_tables
       WHERE schemaname IN ('mod_products', 'mod_cart')
       ORDER BY schemaname, tablename`,
		);
		expect(modTables.rows.length).toBeGreaterThan(0);
		expect(
			modTables.rows.some(
				(row) =>
					row.schemaname === "mod_products" && row.tablename === "product",
			),
		).toBe(true);
		expect(
			modTables.rows.some(
				(row) => row.schemaname === "mod_cart" && row.tablename === "cart",
			),
		).toBe(true);
	});
});
