import { col } from "@86d-app/core/schema/col";
import {
	compileModuleDeclarations,
	emitSql,
} from "@86d-app/core/schema/compile";
import type { Module } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { loadCuratedModules } from "../load-curated-modules";
import {
	applyDisposableDdl,
	applyModuleDdl,
	type TransactionalSqlExecutor,
} from "../schema/apply-disposable-ddl";

function pgliteExecutor(db: PGlite): TransactionalSqlExecutor {
	const exec = async (statement: string) => {
		await db.exec(statement);
	};
	return {
		exec,
		async transaction(run) {
			await db.exec("BEGIN");
			try {
				const result = await run({ exec });
				await db.exec("COMMIT");
				return result;
			} catch (error) {
				await db.exec("ROLLBACK");
				throw error;
			}
		},
	};
}

describe("disposable DDL apply", () => {
	it("applies core and curated module DDL twice without error", async () => {
		const modules = await loadCuratedModules();
		const report = compileModuleDeclarations(modules);
		const moduleSql = emitSql(report.transcoded);

		const db = new PGlite();
		const executor = pgliteExecutor(db);

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

		const modTables = await db.query<{
			schemaname: string;
			tablename: string;
		}>(
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
	}, 30_000);

	it("applies and enforces compiled JSON array length constraints", async () => {
		const module: Module = {
			id: "array-contract",
			version: "1.0.0",
			storage: {
				kind: "relational",
				tables: {
					entry: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
							items: z.array(z.string()).max(5),
						}),
					},
				},
			},
		};
		const report = compileModuleDeclarations([module]);
		const moduleSql = emitSql(report.transcoded);

		expect(moduleSql).toContain('jsonb_array_length("items") <= 5');
		expect(moduleSql).not.toContain('char_length("items")');

		const db = new PGlite();
		await applyModuleDdl(pgliteExecutor(db), moduleSql);
		await db.query(
			`INSERT INTO "mod_array-contract"."entry" ("id", "items") VALUES ($1, $2)`,
			["valid", JSON.stringify(["a", "b", "c", "d", "e"])],
		);
		await expect(
			db.query(
				`INSERT INTO "mod_array-contract"."entry" ("id", "items") VALUES ($1, $2)`,
				["invalid", JSON.stringify(["a", "b", "c", "d", "e", "f"])],
			),
		).rejects.toThrow(/violates check constraint/i);
	}, 30_000);

	it("rolls back the entire Module DDL bundle when a statement fails", async () => {
		const db = new PGlite();
		await expect(
			applyModuleDdl(
				pgliteExecutor(db),
				`CREATE SCHEMA IF NOT EXISTS "mod_rollback-proof";
CREATE TABLE IF NOT EXISTS "mod_rollback-proof"."record" ("id" text PRIMARY KEY);
SELECT * FROM "mod_rollback-proof"."missing";`,
			),
		).rejects.toThrow(/missing/);

		const schemas = await db.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count
			 FROM pg_namespace
			 WHERE nspname = 'mod_rollback-proof'`,
		);
		expect(schemas.rows[0]?.count).toBe("0");
	});
});
