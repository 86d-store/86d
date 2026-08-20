import { describe, expect, it } from "vitest";
import type { Module } from "../../types/module";
import { z } from "../../zod";
import { col } from "../col";
import { compileTableShape } from "../compile/analyze-zod";
import {
	compileModuleDeclarations,
	formatCompileReport,
} from "../compile/index";

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
});

describe("compileModuleDeclarations", () => {
	it("emits nothing for tier-none module", () => {
		const stripe: Module = {
			id: "stripe",
			version: "1.0.0",
			schema: {},
		};

		const report = compileModuleDeclarations([stripe]);
		expect(report.transcoded).toHaveLength(0);
		expect(report.sql.trim()).toBe("");
	});

	it("emits CREATE SCHEMA for transcoded module", () => {
		const cart: Module = {
			id: "cart",
			version: "1.0.0",
			tables: {
				cart: {
					shape: z.object({
						id: z.string().register(col, { pk: true }),
						status: z.enum(["active", "abandoned"]),
					}),
				},
			},
		};

		const report = compileModuleDeclarations([cart]);
		expect(report.sql).toContain('CREATE SCHEMA IF NOT EXISTS "mod_cart"');
		expect(report.sql).toContain(
			'CREATE TABLE IF NOT EXISTS "mod_cart"."cart"',
		);
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
		};

		const report = compileModuleDeclarations([cart]);
		expect(report.sql).toContain("DO $$ BEGIN");
		expect(report.sql).toContain("WHEN duplicate_object THEN NULL");
		expect(report.sql).toContain("ADD CONSTRAINT");
	});
});
