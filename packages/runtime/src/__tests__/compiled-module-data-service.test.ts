import { col, compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";
import { PGlite } from "@electric-sql/pglite";
import { splitModuleDdlStatements } from "db/schema/apply-disposable-ddl";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { CompiledModuleDataService } from "../compiled-module-data-service";

const productShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string(),
	status: z.string(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
});

describe("CompiledModuleDataService", () => {
	const client = new PGlite();
	const db = drizzle(client);

	afterAll(async () => {
		await client.close();
	});

	it("round-trips upsert and get against a compiled table", async () => {
		const module: Module = {
			id: "products",
			version: "0.0.1",
			tables: { product: { shape: productShape } },
		};
		const report = compileModuleDeclarations([module]);
		const sql = emitSql(report.transcoded);
		for (const statement of splitModuleDdlStatements(sql)) {
			await client.exec(statement);
		}

		const data = new CompiledModuleDataService({
			db,
			storeId: "11111111-1111-1111-1111-111111111111",
			moduleId: "products",
			moduleDbId: "22222222-2222-2222-2222-222222222222",
			compiled: report.transcoded,
		});

		await data.upsert("product", "prod_1", {
			id: "prod_1",
			name: "Coat",
			slug: "coat",
			status: "active",
		});
		const got = await data.get("product", "prod_1");
		expect(got).toMatchObject({
			id: "prod_1",
			name: "Coat",
			slug: "coat",
			status: "active",
		});

		const listed = await data.findMany("product", {
			where: { slug: "coat" },
			take: 10,
		});
		expect(listed).toHaveLength(1);
	});
});
