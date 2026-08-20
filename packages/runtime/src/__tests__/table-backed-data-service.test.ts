import { col, compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { TableBackedModuleDataService } from "../table-backed-data-service";

const cartModule: Module = {
	id: "cart",
	version: "1.0.0",
	tables: {
		cart: {
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.enum(["active", "abandoned", "converted"]),
				expiresAt: z.coerce.date(),
				metadata: z.record(z.string(), z.unknown()).optional(),
				createdAt: z.coerce.date(),
				updatedAt: z.coerce.date(),
			}),
		},
	},
};

function pgliteExecutor(db: PGlite) {
	return {
		async query<T extends Record<string, unknown>>(
			sql: string,
			params: readonly unknown[] = [],
		) {
			const result = await db.query<T>(sql, params as unknown[]);
			return { rows: result.rows };
		},
	};
}

async function applySql(db: PGlite, sql: string): Promise<void> {
	for (const statement of sql
		.split(";")
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && !part.startsWith("--"))) {
		await db.exec(`${statement};`);
	}
}

describe("TableBackedModuleDataService", () => {
	it("reads and writes cart entities against compiled DDL", async () => {
		const db = new PGlite();
		const ddl = emitSql(compileModuleDeclarations([cartModule]).transcoded);
		await applySql(db, ddl);

		const data = new TableBackedModuleDataService({
			moduleId: "cart",
			executor: pgliteExecutor(db),
		});

		const expiresAt = new Date("2026-01-01T00:00:00.000Z");
		await data.upsert("cart", "cart_1", {
			id: "cart_1",
			status: "active",
			expiresAt,
			metadata: {},
			createdAt: expiresAt,
			updatedAt: expiresAt,
		});

		const cart = await data.get("cart", "cart_1");
		expect(cart?.status).toBe("active");

		const listed = await data.findMany("cart", {
			where: { status: "active" },
		});
		expect(listed).toHaveLength(1);
	});
});
