import { col, compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { PGlite } from "@electric-sql/pglite";
import { applyDisposableDdl } from "db/schema/apply-disposable-ddl";
import { ShadowTableStore } from "db/schema/compiled-table-drizzle";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { DualReadModuleDataService } from "../dual-read-data-service";

type CartEntity = {
	id: string;
	status: "active" | "abandoned" | "converted";
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
};

type CartEntities = {
	cart: CartEntity;
};

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

class MemoryCartDataService {
	readonly #rows = new Map<string, CartEntity>();

	async get(entityType: "cart", entityId: string): Promise<CartEntity | null> {
		if (entityType !== "cart") {
			return null;
		}
		return this.#rows.get(entityId) ?? null;
	}

	async upsert(
		entityType: "cart",
		entityId: string,
		data: CartEntity,
	): Promise<void> {
		if (entityType !== "cart") {
			return;
		}
		this.#rows.set(entityId, data);
	}

	async delete(entityType: "cart", entityId: string): Promise<void> {
		if (entityType !== "cart") {
			return;
		}
		this.#rows.delete(entityId);
	}

	async findMany(entityType: "cart"): Promise<CartEntity[]> {
		if (entityType !== "cart") {
			return [];
		}
		return [...this.#rows.values()];
	}

	mutate(entityId: string, patch: Partial<CartEntity>): void {
		const current = this.#rows.get(entityId);
		if (!current) {
			return;
		}
		this.#rows.set(entityId, { ...current, ...patch });
	}
}

describe("DualReadModuleDataService", () => {
	it("keeps shadow in sync for valid upserts", async () => {
		const db = new PGlite();
		const report = compileModuleDeclarations([cartModule]);
		await applyDisposableDdl(
			{
				async exec(statement) {
					await db.exec(statement);
				},
			},
			{ moduleSql: emitSql(report.transcoded) },
		);
		const shadow = new ShadowTableStore({
			db: drizzle(db),
			compiled: report.transcoded,
		});
		const primary = new MemoryCartDataService();
		const metrics = { mismatches: 0, shadowSkips: 0 };
		const data = new DualReadModuleDataService<CartEntities>({
			moduleId: "cart",
			primary,
			shadow,
			shapes: {
				cart: cartModule.tables?.cart.shape as z.ZodObject<z.ZodRawShape>,
			},
			metrics,
		});

		const now = new Date("2026-01-01T00:00:00.000Z");
		await data.upsert("cart", "cart-1", {
			id: "cart-1",
			status: "active",
			expiresAt: now,
			createdAt: now,
			updatedAt: now,
		});
		await data.get("cart", "cart-1");
		expect(metrics.mismatches).toBe(0);
		expect(metrics.shadowSkips).toBe(0);
	});

	it("increments mismatches when JSON diverges from shadow", async () => {
		const db = new PGlite();
		const report = compileModuleDeclarations([cartModule]);
		await applyDisposableDdl(
			{
				async exec(statement) {
					await db.exec(statement);
				},
			},
			{ moduleSql: emitSql(report.transcoded) },
		);
		const shadow = new ShadowTableStore({
			db: drizzle(db),
			compiled: report.transcoded,
		});
		const primary = new MemoryCartDataService();
		const metrics = { mismatches: 0, shadowSkips: 0 };
		const data = new DualReadModuleDataService<CartEntities>({
			moduleId: "cart",
			primary,
			shadow,
			shapes: {
				cart: cartModule.tables?.cart.shape as z.ZodObject<z.ZodRawShape>,
			},
			metrics,
		});

		const now = new Date("2026-01-01T00:00:00.000Z");
		await data.upsert("cart", "cart-2", {
			id: "cart-2",
			status: "active",
			expiresAt: now,
			createdAt: now,
			updatedAt: now,
		});
		primary.mutate("cart-2", { status: "abandoned" });
		await data.get("cart", "cart-2");
		expect(metrics.mismatches).toBe(1);
	});

	it("skips shadow writes for invalid Zod rows without throwing", async () => {
		const db = new PGlite();
		const report = compileModuleDeclarations([cartModule]);
		await applyDisposableDdl(
			{
				async exec(statement) {
					await db.exec(statement);
				},
			},
			{ moduleSql: emitSql(report.transcoded) },
		);
		const shadow = new ShadowTableStore({
			db: drizzle(db),
			compiled: report.transcoded,
		});
		const primary = new MemoryCartDataService();
		const metrics = { mismatches: 0, shadowSkips: 0 };
		const data = new DualReadModuleDataService<CartEntities>({
			moduleId: "cart",
			primary,
			shadow,
			shapes: {
				cart: cartModule.tables?.cart.shape as z.ZodObject<z.ZodRawShape>,
			},
			metrics,
		});

		const now = new Date("2026-01-01T00:00:00.000Z");
		await data.upsert("cart", "cart-bad", {
			id: "cart-bad",
			status: "active",
			expiresAt: "not-a-date" as unknown as Date,
			createdAt: now,
			updatedAt: now,
		});
		expect(metrics.shadowSkips).toBe(1);
	});
});
