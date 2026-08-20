import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	CompiledModuleDataService,
	ModuleConfigAccessError,
	ModuleRoleContextError,
} from "../compiled-module-data-service";

describe("CompiledModuleDataService isolation", () => {
	it("denies raw connection access", () => {
		const service = new CompiledModuleDataService({
			db: {} as never,
			storeId: "00000000-0000-0000-0000-000000000001",
			moduleId: "cart",
			moduleDbId: "00000000-0000-0000-0000-000000000002",
			compiled: [],
			enforceIsolation: true,
		});
		expect(() => service.getConnection()).toThrow(ModuleRoleContextError);
	});

	it("denies operations when role context is missing", async () => {
		const service = new CompiledModuleDataService({
			db: {} as never,
			storeId: "00000000-0000-0000-0000-000000000001",
			moduleId: "cart",
			moduleDbId: "00000000-0000-0000-0000-000000000002",
			compiled: [
				{
					moduleId: "cart",
					tables: [
						{
							moduleId: "cart",
							schemaName: "mod_cart",
							tableName: "cart",
							shape: z.object({ id: z.string() }),
							columns: [
								{
									name: "id",
									sqlType: "text",
									nullable: false,
									optional: false,
									acceptsNull: false,
									meta: { pk: true },
									checkConstraints: [],
								},
							],
							primaryKey: ["id"],
							uniqueConstraints: [],
							indexes: [],
							foreignKeys: [],
							excludeConstraints: [],
						},
					],
				},
			],
			enforceIsolation: true,
		});

		await expect(service.get("cart", "x")).rejects.toBeInstanceOf(
			ModuleRoleContextError,
		);
	});

	it("denies undeclared config keys", async () => {
		const service = new CompiledModuleDataService({
			db: {} as never,
			storeId: "00000000-0000-0000-0000-000000000001",
			moduleId: "settings",
			moduleDbId: "00000000-0000-0000-0000-000000000002",
			compiled: [],
			enforceIsolation: false,
			configSchemas: {
				store_name: z.string(),
			},
		});

		await expect(service.getConfig("foreign_key")).rejects.toBeInstanceOf(
			ModuleConfigAccessError,
		);
	});
});
