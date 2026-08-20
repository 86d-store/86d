import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
	AnyDurableEventConsumer,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import {
	consumeDurableEvent,
	inventoryStockAdjustedV1,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DurableEventDispatcher } from "../durable-event-dispatcher";
import { UniversalDataService } from "../universal-data-service";

// This exercises the one flow migrated off the in-memory bus in M3:
// Inventory commits `inventory.stock-adjusted` with the stock row, and Audit Log
// consumes it from the outbox. Both Modules are reproduced here rather than
// imported, because `modules/` may not depend on `packages/runtime` and the
// isolation boundary in CAP-02 forbids the reverse edge. The event contract and
// the consumer identity are the shipped ones.

const STORE_ID = "22222222-2222-4222-8222-222222222222";
const INVENTORY_DB_ID = "11111111-1111-4111-8111-111111111111";
const AUDIT_DB_ID = "44444444-4444-4444-8444-444444444444";
const CONSUMER = "audit-log.inventory-stock-adjusted.v1";

let database: PGlite;

type Row = Record<string, unknown>;

function quoted(name: string): string {
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
		throw new Error(`Unsupported column identifier "${name}".`);
	}
	return `"${name}"`;
}

function isJsonValue(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		!(value instanceof Date) &&
		!Array.isArray(value)
	);
}

function isInFilter(value: unknown): value is { in: unknown[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		"in" in value &&
		Array.isArray((value as { in: unknown }).in)
	);
}

function bind(value: unknown, params: unknown[]): string {
	if (isJsonValue(value)) {
		params.push(JSON.stringify(value));
		return `$${params.length}::jsonb`;
	}
	params.push(typeof value === "bigint" ? value.toString() : value);
	return `$${params.length}`;
}

function filter(where: Row, params: unknown[]): string {
	const parts = Object.entries(where).map(([column, value]) => {
		if (value === null) return `${quoted(column)} IS NULL`;
		if (isInFilter(value)) {
			const list = value.in.map((entry) => bind(entry, params));
			return list.length === 0 ? "FALSE" : `${quoted(column)} IN (${list})`;
		}
		return `${quoted(column)} = ${bind(value, params)}`;
	});
	return parts.length > 0 ? parts.join(" AND ") : "TRUE";
}

function createAdapter(client: PGlite) {
	async function raw(sql: string, params: unknown[]): Promise<Row[]> {
		return (await client.query<Row>(sql, params)).rows;
	}
	function table(name: string) {
		return {
			async updateMany({ where, data }: { where: Row; data: Row }) {
				const params: unknown[] = [];
				const sets = Object.entries(data).map(([column, value]) =>
					value === null
						? `${quoted(column)} = NULL`
						: `${quoted(column)} = ${bind(value, params)}`,
				);
				const rows = await raw(
					`UPDATE "${name}" SET ${sets.join(", ")} WHERE ${filter(where, params)} RETURNING 1 AS "u"`,
					params,
				);
				return { count: rows.length };
			},
			async create({ data }: { data: Row }) {
				const params: unknown[] = [];
				const columns = Object.keys(data).map(quoted);
				const values = Object.values(data).map((value) => bind(value, params));
				return (
					await raw(
						`INSERT INTO "${name}" (${columns.join(", ")}) VALUES (${values.join(", ")}) RETURNING *`,
						params,
					)
				)[0];
			},
			async findUnique({ where }: { where: Row }) {
				const flat: Row = {};
				for (const [key, value] of Object.entries(where)) {
					if (isJsonValue(value)) Object.assign(flat, value);
					else flat[key] = value;
				}
				const params: unknown[] = [];
				return (
					(
						await raw(
							`SELECT * FROM "${name}" WHERE ${filter(flat, params)} LIMIT 1`,
							params,
						)
					)[0] ?? null
				);
			},
			async findMany({ where }: { where: Row }) {
				const params: unknown[] = [];
				return raw(
					`SELECT * FROM "${name}" WHERE ${filter(where, params)}`,
					params,
				);
			},
		};
	}

	const adapter = {
		$queryRawUnsafe: (sql: string, ...params: unknown[]) => raw(sql, params),
		moduleData: {
			...table("ModuleData"),
			async upsert({ create, update }: { create: Row; update: Row }) {
				const params: unknown[] = [];
				const record: Row = {
					id: crypto.randomUUID(),
					cuid: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
					...create,
				};
				const columns = Object.keys(record).map(quoted);
				const values = Object.values(record).map((value) =>
					bind(value, params),
				);
				const sets = Object.entries(update).map(
					([column, value]) => `${quoted(column)} = ${bind(value, params)}`,
				);
				await raw(
					`INSERT INTO "ModuleData" (${columns.join(", ")}) VALUES (${values.join(", ")})
					 ON CONFLICT ("moduleId", "entityType", "entityId") DO UPDATE SET ${sets.join(", ")}`,
					params,
				);
				return record;
			},
		},
		moduleOutboxEvent: table("ModuleOutboxEvent"),
		moduleEventDelivery: table("ModuleEventDelivery"),
		moduleEventConsumption: table("ModuleEventConsumption"),
		async $transaction<T>(work: (transaction: unknown) => Promise<T>) {
			await client.exec("BEGIN");
			try {
				const result = await work(adapter);
				await client.exec("COMMIT");
				return result;
			} catch (error) {
				await client.exec("ROLLBACK");
				throw error;
			}
		},
	};
	return adapter;
}

// ── The migrated Inventory adjustment ─────────────────────────────────────────

type StockItem = {
	id: string;
	productId: string;
	quantity: number;
	reserved: number;
};

async function adjustStock(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner,
	productId: string,
	delta: number,
): Promise<StockItem> {
	const id = `${productId}:_:_`;
	const existing = (await data.get("inventoryItem", id)) as StockItem | null;
	const base = existing ?? { id, productId, quantity: 0, reserved: 0 };
	const item: StockItem = {
		...base,
		quantity: Math.max(0, base.quantity + delta),
	};
	const applied = item.quantity - base.quantity;
	await transactions.transaction(async (transaction) => {
		await transaction.upsert(
			"inventoryItem",
			id,
			item as unknown as Record<string, unknown>,
		);
		await transaction.emit(inventoryStockAdjustedV1, {
			aggregate: { type: "inventory-item", id },
			payload: {
				productId,
				delta: applied,
				quantity: item.quantity,
				reserved: item.reserved,
				available: Math.max(0, item.quantity - item.reserved),
			},
		});
	});
	return item;
}

// ── The migrated Audit Log consumer ───────────────────────────────────────────

function auditConsumer(onHandle?: () => void): AnyDurableEventConsumer {
	return consumeDurableEvent({
		consumer: CONSUMER,
		owner: "audit-log",
		definition: inventoryStockAdjustedV1,
		handle: async (context, event) => {
			onHandle?.();
			await context.data.upsert("auditEntry", event.id, {
				id: event.id,
				action: "update",
				resource: "inventory",
				resourceId: event.aggregate.id,
				actorType: "system",
				description: `Stock adjusted by ${event.payload.delta}.`,
				createdAt: event.occurredAt,
			});
		},
	});
}

function inventoryService(adapter: ReturnType<typeof createAdapter>) {
	return new UniversalDataService({
		db: adapter,
		storeId: STORE_ID,
		moduleId: "inventory",
		moduleDbId: INVENTORY_DB_ID,
	});
}

function storeProcess(
	adapter: ReturnType<typeof createAdapter>,
	onHandle?: () => void,
) {
	return new DurableEventDispatcher({
		db: adapter,
		storeId: STORE_ID,
		consumers: [auditConsumer(onHandle)],
		getConsumerData: (moduleId, transaction) =>
			new UniversalDataService({
				db: transaction,
				storeId: STORE_ID,
				moduleId,
				moduleDbId: AUDIT_DB_ID,
			}),
	});
}

async function auditEntries(): Promise<Array<{ data: Row }>> {
	const result = await database.query<{ data: Row }>(
		`SELECT "data" FROM "ModuleData"
		 WHERE "moduleId" = $1::uuid AND "entityType" = 'auditEntry'`,
		[AUDIT_DB_ID],
	);
	return result.rows;
}

beforeAll(async () => {
	database = new PGlite({ extensions: { pgcrypto } });
	const directory = resolve(
		import.meta.dirname,
		"../../../db/prisma/migrations",
	);
	for (const migration of readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()) {
		await database.exec(
			readFileSync(resolve(directory, migration, "migration.sql"), "utf8"),
		);
	}
	await database.query(
		`INSERT INTO "Module" ("id", "cuid", "name", "version", "storeId", "createdAt", "updatedAt")
		 VALUES ($1::uuid, 'inventory-module', 'inventory', '1.0.0', $3::uuid, now(), now()),
		        ($2::uuid, 'audit-log-module', 'audit-log', '1.0.0', $3::uuid, now(), now())`,
		[INVENTORY_DB_ID, AUDIT_DB_ID, STORE_ID],
	);
}, 30_000);

afterAll(async () => {
	await database.close();
});

beforeEach(async () => {
	await database.exec(`
		DELETE FROM "ModuleEventConsumption";
		DELETE FROM "ModuleEventDelivery";
		DELETE FROM "ModuleOutboxEvent";
		DELETE FROM "ModuleEventSequence";
		DELETE FROM "ModuleData";
	`);
});

describe("inventory.stock-adjusted reaches Audit Log through the outbox", () => {
	it("records the stock change and the audit entry without a shared database read", async () => {
		const adapter = createAdapter(database);
		const data = inventoryService(adapter);

		await adjustStock(data, data, "product-1", 5);
		await storeProcess(adapter).drain({ limit: 10 });

		const entries = await auditEntries();
		expect(entries).toHaveLength(1);
		expect(entries[0]?.data).toMatchObject({
			resource: "inventory",
			resourceId: "product-1:_:_",
			actorType: "system",
		});

		// Audit Log wrote only its own rows; Inventory owns the stock row.
		const owners = await database.query<{ moduleId: string; total: bigint }>(
			`SELECT "moduleId", count(*)::bigint AS total FROM "ModuleData" GROUP BY "moduleId"`,
		);
		expect(
			Object.fromEntries(
				owners.rows.map((row) => [row.moduleId, Number(row.total)]),
			),
		).toEqual({ [INVENTORY_DB_ID]: 1, [AUDIT_DB_ID]: 1 });
	});

	it("keeps the audit entry when the process dies before delivering", async () => {
		const adapter = createAdapter(database);
		const data = inventoryService(adapter);

		// The request commits and the process dies before any drain.
		await adjustStock(data, data, "product-1", 5);
		expect(await auditEntries()).toHaveLength(0);

		// A later request in a new process delivers the committed event.
		await storeProcess(adapter).drain({ limit: 10 });
		expect(await auditEntries()).toHaveLength(1);
	});

	it("applies an aggregate's adjustments in sequence order", async () => {
		const adapter = createAdapter(database);
		const data = inventoryService(adapter);
		const applied: number[] = [];

		await adjustStock(data, data, "product-1", 5);
		await adjustStock(data, data, "product-1", -2);

		const sequences = await database.query<{ aggregateSequence: string }>(
			`SELECT "aggregateSequence" FROM "ModuleOutboxEvent" ORDER BY "aggregateSequence"`,
		);
		expect(sequences.rows.map((row) => Number(row.aggregateSequence))).toEqual([
			1, 2,
		]);

		const dispatcher = new DurableEventDispatcher({
			db: adapter,
			storeId: STORE_ID,
			consumers: [
				consumeDurableEvent({
					consumer: CONSUMER,
					owner: "audit-log",
					definition: inventoryStockAdjustedV1,
					handle: async (context, event) => {
						applied.push(event.aggregate.sequence);
						await context.data.upsert("auditEntry", event.id, {
							sequence: event.aggregate.sequence,
						});
					},
				}),
			],
			getConsumerData: (moduleId, transaction) =>
				new UniversalDataService({
					db: transaction,
					storeId: STORE_ID,
					moduleId,
					moduleDbId: AUDIT_DB_ID,
				}),
		});

		// The second event is held until the first succeeds, so one drain can
		// only ever apply the head of the aggregate.
		const first = await dispatcher.drain({ limit: 10 });
		expect(first).toMatchObject({ claimed: 1, succeeded: 1 });
		expect(applied).toEqual([1]);

		const second = await dispatcher.drain({ limit: 10 });
		expect(second).toMatchObject({ claimed: 1, succeeded: 1 });
		expect(applied).toEqual([1, 2]);

		expect(await auditEntries()).toHaveLength(2);
		expect((await dispatcher.drain({ limit: 10 })).claimed).toBe(0);
	});

	it("does not create a second audit entry when a delivery repeats", async () => {
		const adapter = createAdapter(database);
		const data = inventoryService(adapter);
		let handled = 0;

		await adjustStock(data, data, "product-1", 5);
		const dispatcher = storeProcess(adapter, () => {
			handled++;
		});
		await dispatcher.drain({ limit: 10 });

		await database.exec(
			`UPDATE "ModuleEventDelivery"
			 SET "state" = 'failed', "succeededAt" = NULL, "lastError" = 'ambiguous ack',
			     "nextAttemptAt" = now() - interval '1 hour'`,
		);
		await dispatcher.drain({ limit: 10 });

		expect(handled).toBe(1);
		expect(await auditEntries()).toHaveLength(1);
	});

	it("leaves no audit entry when the adjustment itself is rolled back", async () => {
		const adapter = createAdapter(database);
		const data = inventoryService(adapter);

		await expect(
			data.transaction(async (transaction) => {
				await transaction.upsert("inventoryItem", "product-1:_:_", {
					quantity: 5,
				});
				await transaction.emit(inventoryStockAdjustedV1, {
					aggregate: { type: "inventory-item", id: "product-1:_:_" },
					payload: {
						productId: "product-1",
						delta: 5,
						quantity: 5,
						reserved: 0,
						available: 5,
					},
				});
				throw new Error("adjustment rejected");
			}),
		).rejects.toThrow(/adjustment rejected/);

		await storeProcess(adapter).drain({ limit: 10 });

		expect(await auditEntries()).toHaveLength(0);
		const events = await database.query(`SELECT 1 FROM "ModuleOutboxEvent"`);
		expect(events.rows).toHaveLength(0);
	});
});
