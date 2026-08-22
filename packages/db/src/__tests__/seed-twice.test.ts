import {
	compileModuleDeclarations,
	emitSql,
} from "@86d-app/core/schema/compile/index";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { loadCuratedModules } from "../load-curated-modules";
import { applyDisposableDdl } from "../schema/apply-disposable-ddl";

async function snapshotSeedOwnedRows(db: PGlite): Promise<string> {
	const tables = await db.query<{
		schemaname: string;
		tablename: string;
	}>(
		`SELECT schemaname, tablename
     FROM pg_tables
     WHERE schemaname LIKE 'mod_%'
     ORDER BY schemaname, tablename`,
	);

	const chunks: string[] = [];
	for (const table of tables.rows) {
		const rows = await db.query(
			`SELECT * FROM "${table.schemaname}"."${table.tablename}" ORDER BY 1`,
		);
		chunks.push(
			JSON.stringify({
				schema: table.schemaname,
				table: table.tablename,
				rows: rows.rows,
			}),
		);
	}
	return chunks.join("\n");
}

async function upsertSeedRow(
	db: PGlite,
	schema: string,
	table: string,
	record: Record<string, unknown>,
): Promise<void> {
	const columns = Object.keys(record);
	const values = columns.map((key) => {
		const value = record[key];
		if (
			value !== null &&
			typeof value === "object" &&
			!(value instanceof Date)
		) {
			return JSON.stringify(value);
		}
		return value;
	});
	const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
	const columnList = columns.map((c) => `"${c}"`).join(", ");
	const updates = columns
		.filter((c) => c !== "id")
		.map((c) => `"${c}" = EXCLUDED."${c}"`)
		.join(", ");

	await db.query(
		`INSERT INTO "${schema}"."${table}" (${columnList})
     VALUES (${placeholders})
     ON CONFLICT ("id") DO UPDATE SET ${updates}`,
		values,
	);
}

describe("seed-twice curated compiled tables", () => {
	it("applies curated DDL and repeats seed-owned upserts without drift", async () => {
		const modules = await loadCuratedModules();
		const report = compileModuleDeclarations(modules);
		expect(report.transcoded.length).toBeGreaterThan(0);
		const moduleSql = emitSql(report.transcoded);
		const again = emitSql(report.transcoded);
		expect(again).toBe(moduleSql);

		const db = new PGlite();
		const executor = {
			async exec(statement: string) {
				await db.exec(statement);
			},
		};

		await applyDisposableDdl(executor, { moduleSql });

		const now = "2026-01-01T00:00:00.000Z";
		const seedOnce = async () => {
			await upsertSeedRow(db, "mod_products", "category", {
				id: "cat-seed-1",
				name: "Atelier",
				slug: "atelier",
				description: "House category",
				image: "",
				position: 0,
				isVisible: true,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			});
			await upsertSeedRow(db, "mod_products", "product", {
				id: "prod-seed-1",
				name: "Observatory Chronograph",
				slug: "observatory-chronograph",
				description: "Seed product",
				shortDescription: "Seed",
				price: 2400,
				sku: "OBS-001",
				inventory: 4,
				trackInventory: true,
				allowBackorder: false,
				status: "active",
				categoryId: "cat-seed-1",
				images: [],
				tags: [],
				metadata: {},
				weight: 1,
				weightUnit: "kg",
				isFeatured: true,
				createdAt: now,
				updatedAt: now,
			});
			await upsertSeedRow(db, "mod_cart", "cart", {
				id: "cart-seed-1",
				status: "active",
				expiresAt: now,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			});
		};

		await seedOnce();
		const first = await snapshotSeedOwnedRows(db);
		await seedOnce();
		const second = await snapshotSeedOwnedRows(db);

		expect(second).toBe(first);

		const productCount = await db.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM "mod_products"."product"`,
		);
		expect(productCount.rows[0]?.count).toBe("1");

		const cartCount = await db.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM "mod_cart"."cart"`,
		);
		expect(cartCount.rows[0]?.count).toBe("1");
	}, 60_000);
});
