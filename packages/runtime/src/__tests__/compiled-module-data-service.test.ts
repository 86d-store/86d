import { col } from "@86d-app/core/schema/col";
import {
	compileModuleDeclarations,
	emitSql,
} from "@86d-app/core/schema/compile";
import type { Module } from "@86d-app/core/types/module";
import { PGlite } from "@electric-sql/pglite";
import { splitModuleDdlStatements } from "db/schema/apply-disposable-ddl";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, describe, expect, it, vi } from "vitest";
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

const customerShape = z.object({
	id: z.string().register(col, { pk: true }),
	email: z.string(),
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

	it("reads a customer row for update once inside a transaction", async () => {
		const module: Module = {
			id: "customers",
			version: "0.0.1",
			tables: { customer: { shape: customerShape } },
		};
		const report = compileModuleDeclarations([module]);
		const sql = emitSql(report.transcoded);
		for (const statement of splitModuleDdlStatements(sql)) {
			await client.exec(statement);
		}

		const data = new CompiledModuleDataService({
			db,
			storeId: "11111111-1111-1111-1111-111111111111",
			moduleId: "customers",
			moduleDbId: "33333333-3333-3333-3333-333333333333",
			compiled: report.transcoded,
		});
		await data.upsert("customer", "cust_1", {
			id: "cust_1",
			email: "customer@example.com",
		});

		const lockRead = vi.spyOn(
			CompiledModuleDataService.prototype,
			"getForUpdate",
		);
		try {
			const customer = await data.transaction((transaction) => {
				if (
					!("getForUpdate" in transaction) ||
					typeof transaction.getForUpdate !== "function"
				) {
					throw new Error("expected a locking transaction");
				}
				return transaction.getForUpdate("customer", "cust_1");
			});

			expect(customer).toMatchObject({
				id: "cust_1",
				email: "customer@example.com",
			});
			expect(lockRead).toHaveBeenCalledTimes(1);
		} finally {
			lockRead.mockRestore();
		}
	});
});
