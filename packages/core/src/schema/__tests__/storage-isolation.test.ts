import { describe, expect, it } from "vitest";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { col } from "../col";
import {
	compileIsolationArtifacts,
	compileModuleDeclarations,
	emitIsolationSql,
	StorageDeclarationError,
	validateStorageDeclaration,
} from "../index";

describe("validateStorageDeclaration", () => {
	it("rejects absent storage", () => {
		const issues = validateStorageDeclaration("cart", undefined);
		expect(issues.some((i) => i.code === "storage_required")).toBe(true);
	});

	it("rejects empty config", () => {
		const issues = validateStorageDeclaration("settings", {
			kind: "config",
			config: {},
		});
		expect(issues.some((i) => i.code === "config_empty")).toBe(true);
	});

	it("rejects empty relational", () => {
		const issues = validateStorageDeclaration("cart", {
			kind: "relational",
		});
		expect(issues.some((i) => i.code === "relational_empty")).toBe(true);
	});

	it("rejects mixed-branch forbidden fields on none", () => {
		const issues = validateStorageDeclaration("stripe", {
			kind: "none",
			config: { x: z.string() },
		} as never);
		expect(issues.some((i) => i.code === "storage_forbidden_field")).toBe(true);
	});

	it("rejects publish of unknown column", () => {
		const issues = validateStorageDeclaration("cart", {
			kind: "relational",
			tables: {
				cart: {
					shape: z.object({
						id: z.string().register(col, { pk: true }),
					}),
				},
			},
			publishes: {
				cart: {
					version: "1.0.0",
					table: "cart",
					columns: ["id", "missing"],
				},
			},
		});
		expect(issues.some((i) => i.code === "publish_unknown_column")).toBe(true);
	});
});

describe("isolation compile", () => {
	it("emits byte-stable isolation SQL across two compiles", () => {
		const module: Module = {
			id: "cart",
			version: "1.0.0",
			storage: {
				kind: "relational",
				config: {
					guest_ttl_days: z.int().min(1).max(30),
				},
				tables: {
					cart: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
							status: z.enum(["active", "abandoned"]),
						}),
					},
				},
				publishes: {
					cart: {
						version: "1.0.0",
						table: "cart",
						columns: ["id", "status"],
					},
				},
			},
		};

		const first = compileModuleDeclarations([module]).sql;
		const second = compileModuleDeclarations([module]).sql;
		expect(first).toBe(second);
		expect(first).toContain("CREATE ROLE");
		expect(first).toContain("statement_timeout");
		expect(first).toContain("SECURITY DEFINER");
		expect(first).toContain("cfg_cart_get");
		expect(first).toContain('CREATE OR REPLACE VIEW "pub"');
	});

	it("builds isolation artifacts for config keys and roles", () => {
		const module: Module = {
			id: "settings",
			version: "1.0.0",
			storage: {
				kind: "config",
				config: {
					store_name: z.string(),
				},
			},
		};

		const artifacts = compileIsolationArtifacts([module]);
		expect(artifacts).toHaveLength(1);
		expect(artifacts[0]?.roleName).toBe("mod_settings");
		expect(artifacts[0]?.configKeys).toEqual(["store_name"]);
		const sql = emitIsolationSql(artifacts);
		expect(sql).toContain("REVOKE ALL ON FUNCTION");
		expect(sql).toContain("store_login");
	});

	it("throws StorageDeclarationError for invalid relational publish", () => {
		expect(() =>
			compileIsolationArtifacts([
				{
					id: "cart",
					version: "1.0.0",
					storage: {
						kind: "relational",
						tables: {
							cart: {
								shape: z.object({
									id: z.string().register(col, { pk: true }),
								}),
							},
						},
						anchors: [{ table: "missing", column: "id", kind: "cart" }],
					},
				},
			]),
		).toThrow(StorageDeclarationError);
	});
});
