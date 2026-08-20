import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	consumeDurableEvent,
	defineDurableEvent,
} from "@86d-app/core/durable-events";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DurableEventDispatcher } from "../durable-event-dispatcher";
import { UniversalDataService } from "../universal-data-service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STORE_ID = "22222222-2222-4222-8222-222222222222";
const INVENTORY_DB_ID = "11111111-1111-4111-8111-111111111111";
const AUDIT_DB_ID = "44444444-4444-4444-8444-444444444444";
const CONSUMER = "audit-log.inventory-stock-adjusted.v1";

const stockAdjusted = defineDurableEvent({
	name: "inventory.stock-adjusted",
	version: 1,
	owner: "inventory",
	payload: z
		.object({
			productId: z.string().min(1).max(255),
			delta: z.number().int(),
			quantity: z.number().int().nonnegative(),
		})
		.strict(),
});

const migrationsDirectory = resolve(
	import.meta.dirname,
	"../../../db/prisma/migrations",
);

let database: PGlite;

// ── Prisma-shaped adapter over PGlite ─────────────────────────────────────────
// The dispatcher and data service speak a small, fixed slice of the Prisma
// client. Mapping exactly that slice onto real SQL keeps this test honest: every
// CHECK constraint, foreign key, partial index, and `FOR UPDATE SKIP LOCKED`
// claim in the shipped migration is exercised.

type Row = Record<string, unknown>;

function quoteIdentifier(name: string): string {
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

function bindValue(
	value: unknown,
	params: unknown[],
): { placeholder: string; params: unknown[] } {
	if (isJsonValue(value)) {
		params.push(JSON.stringify(value));
		return { placeholder: `$${params.length}::jsonb`, params };
	}
	params.push(typeof value === "bigint" ? value.toString() : value);
	return { placeholder: `$${params.length}`, params };
}

function isInFilter(value: unknown): value is { in: unknown[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		"in" in value &&
		Array.isArray((value as { in: unknown }).in)
	);
}

function whereClause(
	where: Row,
	params: unknown[],
): { sql: string; params: unknown[] } {
	const parts = Object.entries(where).map(([column, value]) => {
		if (value === null) return `${quoteIdentifier(column)} IS NULL`;
		if (isInFilter(value)) {
			const placeholders = value.in.map(
				(entry) => bindValue(entry, params).placeholder,
			);
			return placeholders.length === 0
				? "FALSE"
				: `${quoteIdentifier(column)} IN (${placeholders.join(", ")})`;
		}
		const bound = bindValue(value, params);
		return `${quoteIdentifier(column)} = ${bound.placeholder}`;
	});
	return { sql: parts.length > 0 ? parts.join(" AND ") : "TRUE", params };
}

function createAdapter(client: PGlite) {
	async function raw(sql: string, params: unknown[]): Promise<Row[]> {
		const result = await client.query<Row>(sql, params);
		return result.rows;
	}

	function table(name: string) {
		return {
			async updateMany({ where, data }: { where: Row; data: Row }) {
				const params: unknown[] = [];
				const sets = Object.entries(data).map(([column, value]) => {
					if (value === null) return `${quoteIdentifier(column)} = NULL`;
					const bound = bindValue(value, params);
					return `${quoteIdentifier(column)} = ${bound.placeholder}`;
				});
				const filter = whereClause(where, params);
				const rows = await raw(
					`UPDATE "${name}" SET ${sets.join(", ")} WHERE ${filter.sql} RETURNING 1 AS "updated"`,
					params,
				);
				return { count: rows.length };
			},
			async create({ data }: { data: Row }) {
				const params: unknown[] = [];
				const columns = Object.keys(data).map(quoteIdentifier);
				const values = Object.values(data).map(
					(value) => bindValue(value, params).placeholder,
				);
				const rows = await raw(
					`INSERT INTO "${name}" (${columns.join(", ")}) VALUES (${values.join(", ")}) RETURNING *`,
					params,
				);
				return rows[0];
			},
			async findUnique({ where }: { where: Row }) {
				const flattened: Row = {};
				for (const [key, value] of Object.entries(where)) {
					if (isJsonValue(value)) Object.assign(flattened, value);
					else flattened[key] = value;
				}
				const params: unknown[] = [];
				const filter = whereClause(flattened, params);
				const rows = await raw(
					`SELECT * FROM "${name}" WHERE ${filter.sql} LIMIT 1`,
					params,
				);
				return rows[0] ?? null;
			},
			async findMany({ where }: { where: Row }) {
				const params: unknown[] = [];
				const filter = whereClause(where, params);
				return raw(`SELECT * FROM "${name}" WHERE ${filter.sql}`, params);
			},
		};
	}

	const moduleData = {
		...table("ModuleData"),
		async upsert({
			where,
			create,
			update,
		}: {
			where: { module_entity_unique: Row };
			create: Row;
			update: Row;
		}) {
			const key = where.module_entity_unique;
			const params: unknown[] = [];
			const record: Row = {
				id: crypto.randomUUID(),
				cuid: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
				...create,
			};
			const columns = Object.keys(record).map(quoteIdentifier);
			const values = Object.values(record).map(
				(value) => bindValue(value, params).placeholder,
			);
			const sets = Object.entries(update).map(([column, value]) => {
				const bound = bindValue(value, params);
				return `${quoteIdentifier(column)} = ${bound.placeholder}`;
			});
			await raw(
				`INSERT INTO "ModuleData" (${columns.join(", ")})
				 VALUES (${values.join(", ")})
				 ON CONFLICT ("moduleId", "entityType", "entityId")
				 DO UPDATE SET ${sets.join(", ")}`,
				params,
			);
			return { ...key, ...record };
		},
	};

	const adapter = {
		$queryRawUnsafe: (sql: string, ...params: unknown[]) => raw(sql, params),
		moduleData,
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

// ── Harness ───────────────────────────────────────────────────────────────────

function inventoryData(adapter: ReturnType<typeof createAdapter>) {
	return new UniversalDataService({
		db: adapter,
		storeId: STORE_ID,
		moduleId: "inventory",
		moduleDbId: INVENTORY_DB_ID,
	});
}

/** A fresh dispatcher stands for a newly started process. */
function newProcess(
	adapter: ReturnType<typeof createAdapter>,
	handle: (event: { id: string; payload: unknown }) => Promise<void>,
	options?: { maxAttempts?: number },
) {
	return new DurableEventDispatcher({
		db: adapter,
		storeId: STORE_ID,
		maxAttempts: options?.maxAttempts ?? 3,
		consumers: [
			consumeDurableEvent({
				consumer: CONSUMER,
				owner: "audit-log",
				definition: stockAdjusted,
				handle: async (context, event) => {
					await handle(event);
					await context.data.upsert("auditEntry", event.id, {
						resource: event.aggregate.type,
						sequence: event.aggregate.sequence,
					});
				},
			}),
		],
		getConsumerData: (_moduleId, transaction) =>
			new UniversalDataService({
				db: transaction,
				storeId: STORE_ID,
				moduleId: "audit-log",
				moduleDbId: AUDIT_DB_ID,
			}),
	});
}

async function countRows(table: string, where = "TRUE"): Promise<number> {
	const result = await database.query<{ total: bigint }>(
		`SELECT count(*)::bigint AS total FROM "${table}" WHERE ${where}`,
	);
	return Number(result.rows[0]?.total ?? 0);
}

async function deliveryRow(): Promise<{
	state: string;
	attempts: number;
	lastError: string | null;
} | null> {
	const result = await database.query<{
		state: string;
		attempts: number;
		lastError: string | null;
	}>(`SELECT "state", "attempts", "lastError" FROM "ModuleEventDelivery"`);
	return result.rows[0] ?? null;
}

beforeAll(async () => {
	database = new PGlite({ extensions: { pgcrypto } });
	for (const migration of readdirSync(migrationsDirectory, {
		withFileTypes: true,
	})
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()) {
		await database.exec(
			readFileSync(
				resolve(migrationsDirectory, migration, "migration.sql"),
				"utf8",
			),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("durable delivery against the shipped schema", () => {
	it("commits owner state and its outbox event in one transaction", async () => {
		const adapter = createAdapter(database);

		await inventoryData(adapter).transaction(async (transaction) => {
			await transaction.upsert("inventoryItem", "product-1:_:_", {
				quantity: 9,
			});
			await transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			});
		});

		expect(await countRows("ModuleData")).toBe(1);
		expect(await countRows("ModuleOutboxEvent")).toBe(1);
	});

	it("rolls back state and the event together when the work fails", async () => {
		const adapter = createAdapter(database);

		await expect(
			inventoryData(adapter).transaction(async (transaction) => {
				await transaction.upsert("inventoryItem", "product-1:_:_", {
					quantity: 9,
				});
				await transaction.emit(stockAdjusted, {
					aggregate: { type: "inventory-item", id: "product-1:_:_" },
					payload: { productId: "product-1", delta: 4, quantity: 9 },
				});
				throw new Error("owner work failed after emit");
			}),
		).rejects.toThrow(/owner work failed/);

		// Neither the state change nor the event survives a failed commit.
		expect(await countRows("ModuleData")).toBe(0);
		expect(await countRows("ModuleOutboxEvent")).toBe(0);
		expect(await countRows("ModuleEventSequence")).toBe(0);
	});

	it("delivers an event committed before the process that emitted it died", async () => {
		const adapter = createAdapter(database);

		// Process A commits the event and then dies without draining.
		await inventoryData(adapter).transaction(async (transaction) => {
			await transaction.upsert("inventoryItem", "product-1:_:_", {
				quantity: 9,
			});
			await transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			});
		});

		// Process B starts fresh and finds the committed work.
		const delivered: string[] = [];
		const result = await newProcess(adapter, async (event) => {
			delivered.push(event.id);
		}).drain({ limit: 10 });

		expect(result).toMatchObject({ claimed: 1, succeeded: 1, failed: 0 });
		expect(delivered).toHaveLength(1);
		expect(await countRows("ModuleData", `"moduleId" = '${AUDIT_DB_ID}'`)).toBe(
			1,
		);
	});

	it("reclaims a delivery abandoned mid-flight by a dead process", async () => {
		const adapter = createAdapter(database);
		await inventoryData(adapter).transaction(async (transaction) => {
			await transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			});
		});

		// Process A claims the delivery, takes a lease, and dies before it can
		// acknowledge or record a failure: the row stays in `processing`.
		await database.exec(`
			INSERT INTO "ModuleEventDelivery" (
				"eventId", "consumer", "state", "attempts", "nextAttemptAt",
				"leaseToken", "leaseOwner", "leaseExpiresAt"
			)
			SELECT "id", '${CONSUMER}', 'processing', 1, now() - interval '1 hour',
			       gen_random_uuid(), 'dead-process-a', now() - interval '1 minute'
			FROM "ModuleOutboxEvent"
		`);
		expect(await deliveryRow()).toMatchObject({ state: "processing" });

		// Process B finds the expired lease and completes the delivery.
		const result = await newProcess(adapter, async () => {}).drain({
			limit: 10,
		});

		expect(result).toMatchObject({ claimed: 1, succeeded: 1 });
		expect(await deliveryRow()).toMatchObject({ state: "succeeded" });
	});

	it("makes duplicate delivery harmless through the consumption receipt", async () => {
		const adapter = createAdapter(database);
		await inventoryData(adapter).transaction(async (transaction) => {
			await transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			});
		});

		let handlerRuns = 0;
		const dispatcher = newProcess(adapter, async () => {
			handlerRuns++;
		});
		await dispatcher.drain({ limit: 10 });

		// Force the delivery back to a claimable state, as an at-least-once
		// transport would after an ambiguous acknowledgement.
		await database.exec(
			`UPDATE "ModuleEventDelivery"
			 SET "state" = 'failed', "succeededAt" = NULL, "lastError" = 'ambiguous ack',
			     "nextAttemptAt" = now() - interval '1 hour'`,
		);
		const second = await dispatcher.drain({ limit: 10 });

		expect(second).toMatchObject({ claimed: 1, succeeded: 1, failed: 0 });
		expect(handlerRuns).toBe(1);
		expect(await countRows("ModuleEventConsumption")).toBe(1);
		expect(await countRows("ModuleData", `"moduleId" = '${AUDIT_DB_ID}'`)).toBe(
			1,
		);
	});

	it("stops retrying a poison event once its attempt budget is spent", async () => {
		const adapter = createAdapter(database);
		await inventoryData(adapter).transaction(async (transaction) => {
			await transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			});
		});

		let handlerRuns = 0;
		const poison = newProcess(
			adapter,
			async () => {
				handlerRuns++;
				throw new Error("poison event");
			},
			{ maxAttempts: 3 },
		);

		const outcomes: Array<{ claimed: number; deadLettered: number }> = [];
		for (let attempt = 0; attempt < 6; attempt++) {
			const result = await poison.drain({ limit: 10 });
			outcomes.push({
				claimed: result.claimed,
				deadLettered: result.deadLettered,
			});
			// Retry backoff is real time; move the clock forward in the data.
			await database.exec(
				`UPDATE "ModuleEventDelivery"
				 SET "nextAttemptAt" = now() - interval '1 hour'
				 WHERE "state" <> 'dead_letter'`,
			);
		}

		// The handler runs exactly maxAttempts times and never again.
		expect(handlerRuns).toBe(3);
		expect(outcomes.slice(3).every((o) => o.claimed === 0)).toBe(true);
		expect(outcomes.reduce((sum, o) => sum + o.deadLettered, 0)).toBe(1);

		const delivery = await deliveryRow();
		expect(delivery).toMatchObject({ state: "dead_letter", attempts: 3 });
		expect(delivery?.lastError).toBeTruthy();

		const event = await database.query<{ deliveryState: string }>(
			`SELECT "deliveryState" FROM "ModuleOutboxEvent"`,
		);
		expect(event.rows[0]?.deliveryState).toBe("dead_letter");
		expect(await countRows("ModuleEventConsumption")).toBe(0);
	});

	it("holds later events for an aggregate whose earlier event dead-lettered", async () => {
		const adapter = createAdapter(database);
		const data = inventoryData(adapter);
		await data.transaction((transaction) =>
			transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: 4, quantity: 9 },
			}),
		);
		await data.transaction((transaction) =>
			transaction.emit(stockAdjusted, {
				aggregate: { type: "inventory-item", id: "product-1:_:_" },
				payload: { productId: "product-1", delta: -1, quantity: 8 },
			}),
		);

		const seen: number[] = [];
		const dispatcher = newProcess(
			adapter,
			async (event) => {
				const payload = event.payload as { quantity: number };
				seen.push(payload.quantity);
				if (payload.quantity === 9) throw new Error("first event is poison");
			},
			{ maxAttempts: 2 },
		);

		for (let attempt = 0; attempt < 5; attempt++) {
			await dispatcher.drain({ limit: 10 });
			await database.exec(
				`UPDATE "ModuleEventDelivery"
				 SET "nextAttemptAt" = now() - interval '1 hour'
				 WHERE "state" <> 'dead_letter'`,
			);
		}

		// The second event is never applied out of order behind a dead letter.
		expect(seen).toEqual([9, 9]);
		expect(await countRows("ModuleData", `"moduleId" = '${AUDIT_DB_ID}'`)).toBe(
			0,
		);
		expect(
			await countRows("ModuleEventDelivery", `"state" = 'dead_letter'`),
		).toBe(1);
	});
});
