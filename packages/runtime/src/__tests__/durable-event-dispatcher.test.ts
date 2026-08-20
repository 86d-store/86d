import type { AnyDurableEventConsumer } from "@86d-app/core/durable-events";
import {
	consumeDurableEvent,
	defineDurableEvent,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DurableEventDispatcher } from "../durable-event-dispatcher";

const adjusted = defineDurableEvent({
	name: "inventory.adjusted",
	version: 1,
	owner: "inventory",
	payload: z
		.object({ productId: z.string(), delta: z.number().int() })
		.strict(),
});

const claimed = {
	eventId: "11111111-1111-4111-8111-111111111111",
	consumer: "audit-log.inventory-adjusted.v1",
	leaseToken: "22222222-2222-4222-8222-222222222222",
	leaseOwner: "drain-worker-1",
	eventType: "inventory.adjusted",
	schemaVersion: 1,
	storeId: "33333333-3333-4333-8333-333333333333",
	sourceModule: "inventory",
	aggregateType: "inventory-item",
	aggregateId: "product-1:_:_",
	aggregateSequence: 1n,
	occurredAt: new Date("2026-08-12T12:00:00.000Z"),
	payload: { productId: "product-1", delta: 4 },
	attempts: 1,
};

function dataService(): ModuleDataService {
	return {
		get: vi.fn().mockResolvedValue(null),
		upsert: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		findMany: vi.fn().mockResolvedValue([]),
	};
}

function createDb(rows = [claimed]) {
	const tx = {
		$queryRawUnsafe: vi.fn().mockResolvedValue([
			{
				consumer: claimed.consumer,
				eventId: claimed.eventId,
				leaseToken: claimed.leaseToken,
				leaseOwner: claimed.leaseOwner,
				state: "processing",
			},
		]),
		moduleEventConsumption: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({}),
		},
		moduleEventDelivery: {
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		moduleOutboxEvent: {
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
	};
	// A drain issues three statements in order: materialize, retire exhausted,
	// then claim. Only the claim yields deliveries to process.
	const statements: string[] = [];
	return {
		tx,
		statements,
		db: {
			$queryRawUnsafe: vi
				.fn()
				.mockImplementation(async (sql: string, ..._params: unknown[]) => {
					statements.push(sql);
					if (sql.includes('INSERT INTO "ModuleEventDelivery"')) return [];
					if (sql.includes("'dead_letter'")) return [];
					return rows;
				}),
			$transaction: vi.fn(
				async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
			),
			moduleEventDelivery: {
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
			moduleOutboxEvent: {
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
		},
	};
}

/** The claim is the last of the three statements a drain issues. */
function claimStatement(statements: readonly string[]): string {
	const claim = statements.at(-1);
	if (!claim) throw new Error("No claim statement was issued.");
	return claim;
}

function consumer(handle?: AnyDurableEventConsumer["handle"]) {
	return consumeDurableEvent({
		consumer: claimed.consumer,
		owner: "audit-log",
		definition: adjusted,
		handle:
			handle ??
			vi.fn(async (context, event) => {
				await context.data.upsert("auditEntry", event.id, {
					resource: event.aggregate.type,
				});
			}),
	});
}

describe("DurableEventDispatcher", () => {
	it("claims a bounded batch with lease fencing and aggregate-local head-of-line", async () => {
		const { db, statements } = createDb([]);
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [consumer()],
			storeId: claimed.storeId,
			maxAttempts: 5,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		await dispatcher.drain({
			limit: 7,
			leaseDurationMs: 30_000,
			now: new Date("2026-08-12T12:00:00.000Z"),
		});

		// Materialization must not share a statement with the claim: CTEs read the
		// snapshot taken when the statement began, so a combined statement could
		// never claim a delivery it had just created.
		expect(statements).toHaveLength(3);
		const sql = claimStatement(statements);
		expect(sql).toMatch(/FOR UPDATE(?: OF delivery)? SKIP LOCKED/);
		expect(sql).toContain("prior.\"state\" <> 'succeeded'");
		expect(sql).toContain(
			'prior_event."aggregateSequence" < event."aggregateSequence"',
		);
		expect(sql).not.toContain('prior."nextAttemptAt"');
		expect(sql).toContain('delivery."attempts" < $7');

		const claimCall = db.$queryRawUnsafe.mock.calls.at(-1);
		expect(claimCall?.[1]).toBe(claimed.storeId);
		expect(claimCall?.[2]).toEqual([claimed.consumer]);
		expect(claimCall?.[3]).toBe(7);
		expect(claimCall?.[7]).toBe(5);
	});

	it("never claims a delivery whose attempt budget is spent", async () => {
		const { db, statements } = createDb([]);
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [consumer()],
			storeId: claimed.storeId,
			maxAttempts: 3,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		await dispatcher.drain({ limit: 5 });

		const retire = statements[1];
		expect(retire).toContain("'dead_letter'");
		expect(retire).toContain('candidate."attempts" >= $5');
		expect(claimStatement(statements)).toContain('delivery."attempts" < $7');
	});

	it("rejects an attempt budget outside its bounds", () => {
		const { db } = createDb([]);
		const build = (maxAttempts: number) =>
			new DurableEventDispatcher({
				db,
				consumers: [consumer()],
				storeId: claimed.storeId,
				maxAttempts,
				getConsumerData: (_moduleId, _transaction) => dataService(),
			});

		expect(() => build(0)).toThrow(/attempt budget/i);
		expect(() => build(51)).toThrow(/attempt budget/i);
		expect(() => build(1.5)).toThrow(/attempt budget/i);
	});

	it("retires a delivery that exhausts its budget instead of retrying it", async () => {
		const { db } = createDb();
		db.$transaction.mockRejectedValueOnce(new Error("poison"));
		const now = new Date("2026-08-12T12:00:00.000Z");
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [consumer()],
			storeId: claimed.storeId,
			// The claimed fixture already carries attempts: 1.
			maxAttempts: 1,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		const result = await dispatcher.drain({ limit: 1, now });

		expect(result).toEqual({
			claimed: 1,
			succeeded: 0,
			failed: 1,
			deadLettered: 1,
		});
		const terminal = db.moduleEventDelivery.updateMany.mock.calls[0][0];
		expect(terminal.data.state).toBe("dead_letter");
		// Terminal, so no further retry is scheduled.
		expect(terminal.data.nextAttemptAt).toEqual(now);
		expect(db.moduleOutboxEvent.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					deliveryState: "dead_letter",
					deliveredAt: null,
				}),
			}),
		);
	});

	it("commits the consumer effect, dedupe receipt, and fenced success together", async () => {
		const { db, tx } = createDb();
		const ownedData = dataService();
		const handler = consumer();
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [handler],
			storeId: claimed.storeId,
			getConsumerData: (_moduleId, transaction) => {
				expect(transaction).toBe(tx);
				return ownedData;
			},
		});

		const result = await dispatcher.drain({ limit: 1 });

		expect(result).toEqual({
			claimed: 1,
			succeeded: 1,
			failed: 0,
			deadLettered: 0,
		});
		expect(db.$transaction).toHaveBeenCalledOnce();
		expect(handler.handle).toHaveBeenCalledOnce();
		expect(tx.moduleEventConsumption.create).toHaveBeenCalledWith({
			data: { consumer: claimed.consumer, eventId: claimed.eventId },
		});
		expect(tx.moduleEventDelivery.updateMany).toHaveBeenCalledWith({
			where: {
				consumer: claimed.consumer,
				eventId: claimed.eventId,
				state: "processing",
				leaseToken: claimed.leaseToken,
				leaseOwner: claimed.leaseOwner,
			},
			data: expect.objectContaining({ state: "succeeded", leaseToken: null }),
		});
	});

	it("skips a duplicate receipt while still completing its delivery", async () => {
		const { db, tx } = createDb();
		tx.moduleEventConsumption.findUnique.mockResolvedValue({
			consumedAt: new Date(),
		});
		const handler = consumer();
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [handler],
			storeId: claimed.storeId,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		const result = await dispatcher.drain({ limit: 1 });

		expect(result.succeeded).toBe(1);
		expect(handler.handle).not.toHaveBeenCalled();
		expect(tx.moduleEventConsumption.create).not.toHaveBeenCalled();
	});

	it("fences a stale claimant before the consumer handler can mutate state", async () => {
		const { db, tx } = createDb();
		tx.$queryRawUnsafe.mockResolvedValue([]);
		const handler = consumer();
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [handler],
			storeId: claimed.storeId,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		const result = await dispatcher.drain({ limit: 1 });

		expect(result).toEqual({
			claimed: 1,
			succeeded: 0,
			failed: 0,
			deadLettered: 0,
		});
		expect(handler.handle).not.toHaveBeenCalled();
		expect(tx.moduleEventConsumption.create).not.toHaveBeenCalled();
		expect(db.moduleEventDelivery.updateMany).not.toHaveBeenCalled();
	});

	it("rolls back the consumer effect and records bounded retry state on failure", async () => {
		const { db, tx } = createDb();
		db.$transaction.mockRejectedValueOnce(
			new Error(`provider ${"secret-".repeat(150)} failed`),
		);
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [consumer()],
			storeId: claimed.storeId,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		const result = await dispatcher.drain({
			limit: 1,
			now: new Date("2026-08-12T12:00:00.000Z"),
		});

		expect(result).toEqual({
			claimed: 1,
			succeeded: 0,
			failed: 1,
			deadLettered: 0,
		});
		const failure = db.moduleEventDelivery.updateMany.mock.calls[0][0];
		expect(failure.where.leaseToken).toBe(claimed.leaseToken);
		expect(failure.where.leaseOwner).toBe(claimed.leaseOwner);
		expect(failure.data.state).toBe("failed");
		expect(failure.data.lastError.length).toBeLessThanOrEqual(500);
		expect(failure.data.lastError).not.toContain("secret");
		expect(failure.data.nextAttemptAt.getTime()).toBeGreaterThan(
			new Date("2026-08-12T12:00:00.000Z").getTime(),
		);
		expect(tx.moduleEventConsumption.create).not.toHaveBeenCalled();
	});

	it("isolates a malformed persisted payload to its delivery", async () => {
		const { db } = createDb([
			{ ...claimed, payload: { productId: "product-1" } } as typeof claimed,
		]);
		const handler = consumer();
		const dispatcher = new DurableEventDispatcher({
			db,
			consumers: [handler],
			storeId: claimed.storeId,
			getConsumerData: (_moduleId, _transaction) => dataService(),
		});

		const result = await dispatcher.drain({ limit: 1 });

		expect(result.failed).toBe(1);
		expect(handler.handle).not.toHaveBeenCalled();
		expect(db.moduleEventDelivery.updateMany).toHaveBeenCalledOnce();
	});
});
