import { describe, expect, it } from "vitest";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { col } from "../col";
import { compileTableShape } from "../compile/analyze-zod";
import {
	compileModuleDeclarations,
	emitSql,
	formatCompileReport,
} from "../compile/index";
import { SchemaCompileError } from "../compile/types";

describe("compileTableShape", () => {
	it("emits CHECK from z.int().min().max()", () => {
		const shape = z.object({
			id: z.uuid().register(col, { pk: true }),
			minutes: z.int().min(5).max(480),
		});

		const table = compileTableShape({
			moduleId: "appointments",
			tableName: "appointment",
			shape,
		});

		const minutes = table.columns.find((c) => c.name === "minutes");
		expect(minutes?.checkConstraints.some((c) => c.includes(">= 5"))).toBe(
			true,
		);
		expect(minutes?.checkConstraints.some((c) => c.includes("<= 480"))).toBe(
			true,
		);
	});

	it("marks primary key from col registry", () => {
		const shape = z.object({
			id: z.uuid().register(col, { pk: true }),
			name: z.string(),
		});

		const table = compileTableShape({
			moduleId: "cart",
			tableName: "cart",
			shape,
		});

		expect(table.primaryKey).toEqual(["id"]);
	});

	it("keeps required non-PK columns NOT NULL", () => {
		const shape = z.object({
			id: z.string().register(col, { pk: true }),
			status: z.string(),
			notes: z.string().optional(),
		});

		const table = compileTableShape({
			moduleId: "cart",
			tableName: "cart",
			shape,
		});

		expect(table.columns.find((c) => c.name === "status")?.nullable).toBe(
			false,
		);
		expect(table.columns.find((c) => c.name === "notes")?.nullable).toBe(true);
	});

	it("emits enum domain CHECK and string width", () => {
		const shape = z.object({
			id: z.string().register(col, { pk: true }),
			status: z.enum(["active", "abandoned"]),
			notes: z.string().max(2000),
		});

		const table = compileTableShape({
			moduleId: "cart",
			tableName: "cart",
			shape,
		});

		expect(
			table.columns
				.find((c) => c.name === "status")
				?.checkConstraints.some((c) => c.includes("'abandoned'")),
		).toBe(true);
		expect(table.columns.find((c) => c.name === "notes")?.sqlType).toBe(
			"varchar(2000)",
		);
	});

	it("emits SQL DEFAULT from Zod default", () => {
		const shape = z.object({
			id: z.string().register(col, { pk: true }),
			status: z.string().default("active"),
		});

		const table = compileTableShape({
			moduleId: "cart",
			tableName: "cart",
			shape,
		});
		const sql = emitSql([{ moduleId: "cart", tables: [table] }]);
		expect(table.columns.find((c) => c.name === "status")?.sqlDefault).toBe(
			"'active'",
		);
		expect(sql).toContain("DEFAULT 'active'");
	});

	it("rejects unknown Zod constructs with provenance", () => {
		const shape = z.object({
			id: z.string().register(col, { pk: true }),
			weird: z.bigint(),
		});

		expect(() =>
			compileTableShape({
				moduleId: "cart",
				tableName: "cart",
				shape,
			}),
		).toThrow(SchemaCompileError);
	});
});

describe("compileModuleDeclarations", () => {
	it("emits nothing for none storage module", () => {
		const stripe: Module = {
			id: "stripe",
			version: "1.0.0",
			storage: { kind: "none" },
		};

		const report = compileModuleDeclarations([stripe]);
		expect(report.transcoded).toHaveLength(0);
	});

	it("emits CREATE SCHEMA for relational storage module", () => {
		const cart: Module = {
			id: "cart",
			version: "1.0.0",
			storage: {
				kind: "relational",
				tables: {
					cart: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
							status: z.enum(["active", "abandoned"]),
						}),
					},
				},
			},
		};

		const report = compileModuleDeclarations([cart]);
		expect(report.sql).toContain('CREATE SCHEMA IF NOT EXISTS "mod_cart"');
		expect(report.sql).toContain(
			'CREATE TABLE IF NOT EXISTS "mod_cart"."cart"',
		);
		expect(report.sql).toContain("SET statement_timeout");
	});

	it("lists legacy-only modules as not transcoded", () => {
		const legacy: Module = {
			id: "wishlist",
			version: "1.0.0",
			schema: {
				wishlist: {
					fields: {
						id: { type: "string", required: true },
					},
				},
			},
		};

		const report = compileModuleDeclarations([legacy]);
		expect(report.notTranscoded).toContain("wishlist");
		const formatted = formatCompileReport(report);
		expect(formatted).toContain("Not transcoded");
	});

	it("wraps foreign key constraints for idempotent re-apply", () => {
		const cart: Module = {
			id: "cart",
			version: "1.0.0",
			storage: {
				kind: "relational",
				tables: {
					cartItem: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
							cartId: z.string().register(col, {
								references: { table: "self.cart", column: "id" },
							}),
						}),
					},
					cart: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
						}),
					},
				},
			},
		};

		const report = compileModuleDeclarations([cart]);
		expect(report.sql).toContain("DO $$ BEGIN");
		expect(report.sql).toContain("WHEN duplicate_object THEN NULL");
		expect(report.sql).toContain("ADD CONSTRAINT");
	});

	it("emits identical DDL across two clean compiles", () => {
		const cart: Module = {
			id: "cart",
			version: "1.0.0",
			storage: {
				kind: "relational",
				tables: {
					cart: {
						shape: z.object({
							id: z.string().register(col, { pk: true }),
							status: z.enum(["active", "abandoned"]).default("active"),
							notes: z.string().max(100).optional(),
						}),
					},
				},
			},
		};

		const first = compileModuleDeclarations([cart]).sql;
		const second = compileModuleDeclarations([cart]).sql;
		expect(first).toBe(second);
	});
});
