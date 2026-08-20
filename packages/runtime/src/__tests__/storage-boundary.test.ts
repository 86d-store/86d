import {
	col,
	compileModuleDeclarations,
	emitSql,
	ModuleStorageParseError,
} from "@86d-app/core/schema";
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
	status: z.enum(["active", "draft"]),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
});

describe("storage-boundary Zod parse", () => {
	const client = new PGlite();
	const db = drizzle(client);

	afterAll(async () => {
		await client.close();
	});

	it("rejects malformed upserts with Module-and-field errors", async () => {
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

		try {
			await data.upsert("product", "prod_bad", {
				id: "prod_bad",
				name: 42,
				slug: "coat",
				status: "active",
			} as never);
			expect.unreachable("expected ModuleStorageParseError");
		} catch (error) {
			expect(error).toBeInstanceOf(ModuleStorageParseError);
			const parseError = error as ModuleStorageParseError;
			expect(parseError.issues[0]?.moduleId).toBe("products");
			expect(parseError.issues[0]?.tableName).toBe("product");
			expect(parseError.issues[0]?.fieldName).toBe("name");
		}
	});

	it("parses valid writes and reads through the table shape", async () => {
		const module: Module = {
			id: "products",
			version: "0.0.1",
			tables: { product: { shape: productShape } },
		};
		const report = compileModuleDeclarations([module]);

		const data = new CompiledModuleDataService({
			db,
			storeId: "11111111-1111-1111-1111-111111111111",
			moduleId: "products",
			moduleDbId: "22222222-2222-2222-2222-222222222222",
			compiled: report.transcoded,
		});

		await data.upsert("product", "prod_ok", {
			id: "prod_ok",
			name: "Coat",
			slug: "coat",
			status: "active",
		});
		const got = await data.get("product", "prod_ok");
		expect(got).toMatchObject({
			id: "prod_ok",
			name: "Coat",
			slug: "coat",
			status: "active",
		});
	});
});
