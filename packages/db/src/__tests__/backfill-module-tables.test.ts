import { readFileSync } from "node:fs";
import { join } from "node:path";
import { col, compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import {
	backfillModuleTables,
	formatBackfillRejection,
	type ModuleDataRow,
} from "../backfill-module-tables";
import { applyDisposableDdl } from "../schema/apply-disposable-ddl";
import { ShadowTableStore } from "../schema/compiled-table-drizzle";

const cartModule: Module = {
	id: "cart",
	version: "1.0.0",
	tables: {
		cart: {
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.enum(["active", "abandoned", "converted"]),
				expiresAt: z.coerce.date(),
				createdAt: z.coerce.date(),
				updatedAt: z.coerce.date(),
			}),
		},
	},
};

async function setupCartShadow() {
	const db = new PGlite();
	const report = compileModuleDeclarations([cartModule]);
	const moduleSql = emitSql(report.transcoded);
	await applyDisposableDdl(
		{
			async exec(statement: string) {
				await db.exec(statement);
			},
		},
		{ moduleSql },
	);
	const drizzleDb = drizzle(db);
	const shadow = new ShadowTableStore({
		db: drizzleDb,
		compiled: report.transcoded,
	});
	return { shadow, modules: [cartModule] };
}

describe("backfillModuleTables", () => {
	it("copies valid rows and reports Zod rejections with stable fixture lines", async () => {
		const { shadow, modules } = await setupCartShadow();
		const now = new Date("2026-01-01T00:00:00.000Z");
		const rows: ModuleDataRow[] = [
			{
				moduleName: "cart",
				entityType: "cart",
				entityId: "cart-valid",
				data: {
					id: "cart-valid",
					status: "active",
					expiresAt: now.toISOString(),
					createdAt: now.toISOString(),
					updatedAt: now.toISOString(),
				},
			},
			{
				moduleName: "cart",
				entityType: "cart",
				entityId: "invalid-cart",
				data: {
					id: "invalid-cart",
					status: "active",
					expiresAt: "not-a-date",
					createdAt: now.toISOString(),
					updatedAt: now.toISOString(),
				},
			},
			{
				moduleName: "stripe",
				entityType: "connection",
				entityId: "ignored",
				data: { id: "ignored" },
			},
		];

		const summary = await backfillModuleTables({ rows, modules, shadow });
		expect(summary.copied).toBe(1);
		expect(summary.rejected).toBe(1);
		expect(summary.skipped).toBe(1);

		const fixture = JSON.parse(
			readFileSync(
				join(import.meta.dirname, "fixtures/backfill-rejections.json"),
				"utf8",
			),
		) as Array<{
			module: string;
			entityType: string;
			entityId: string;
		}>;

		for (const expected of fixture) {
			const rejection = summary.rejections.find(
				(entry) =>
					entry.module === expected.module &&
					entry.entityType === expected.entityType &&
					entry.entityId === expected.entityId,
			);
			expect(rejection).toBeDefined();
			expect(
				formatBackfillRejection(rejection ?? summary.rejections[0]),
			).toContain(`module=${expected.module}`);
		}

		const shadowRow = await shadow.get("cart", "cart", "cart-valid");
		expect(shadowRow?.status).toBe("active");
	});
});
