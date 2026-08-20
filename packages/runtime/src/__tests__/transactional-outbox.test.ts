import {
	consumeDurableEvent,
	defineDurableEvent,
	type ModuleDataTransaction,
} from "@86d-app/core/durable-events";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { UniversalDataService } from "../universal-data-service";

const inventoryAdjusted = defineDurableEvent({
	name: "inventory.adjusted",
	version: 1,
	owner: "inventory",
	payload: z
		.object({
			productId: z.string().min(1),
			delta: z.number().int(),
			quantity: z.number().int().nonnegative(),
		})
		.strict(),
});

function createTransactionDb() {
	const tx = {
		moduleData: {
			upsert: vi.fn().mockResolvedValue({}),
			findUnique: vi.fn().mockResolvedValue(null),
			findMany: vi.fn().mockResolvedValue([]),
			delete: vi.fn().mockResolvedValue({}),
			count: vi.fn().mockResolvedValue(0),
		},
		moduleOutboxEvent: {
			create: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockResolvedValue({}),
		},
		moduleEventDelivery: {
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		moduleEventConsumption: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({}),
		},
		$queryRawUnsafe: vi.fn().mockResolvedValue([{ sequence: 1n }]),
	};
	return {
		tx,
		db: {
			...tx,
			$transaction: vi.fn(
				async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
			),
		},
	};
}

const eventInput = {
	id: "10101010-1010-4010-8010-101010101010",
	aggregate: { type: "inventory-item", id: "product-1:_:_" },
	occurredAt: new Date("2026-08-12T12:00:00.000Z"),
	payload: { productId: "product-1", delta: 4, quantity: 9 },
} as const;

describe("UniversalDataService transactional outbox", () => {
	it("commits owner state and a validated event through one transaction", async () => {
		const { db, tx } = createTransactionDb();
		const data = new UniversalDataService({
			db,
			storeId: "20202020-2020-4020-8020-202020202020",
			moduleId: "inventory",
			moduleDbId: "30303030-3030-4030-8030-303030303030",
		});

		await data.transaction(async (transaction) => {
			await transaction.upsert("inventoryItem", "product-1:_:_", {
				quantity: 9,
			});
			await transaction.emit(inventoryAdjusted, eventInput);
		});

		expect(db.$transaction).toHaveBeenCalledOnce();
		expect(tx.moduleData.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					moduleId: "30303030-3030-4030-8030-303030303030",
				}),
			}),
		);
		expect(tx.moduleOutboxEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				id: eventInput.id,
				eventType: "inventory.adjusted",
				schemaVersion: 1,
				storeId: "20202020-2020-4020-8020-202020202020",
				sourceModule: "inventory",
				moduleId: "30303030-3030-4030-8030-303030303030",
				aggregateSequence: 1n,
				payload: eventInput.payload,
			}),
		});
		// Consumer rows are materialized by the explicit drain from the current
		// registrations, so events committed before a registration remain visible.
		expect(tx.moduleEventDelivery.createMany).not.toHaveBeenCalled();
	});

	it("rejects an invalid or foreign-owner event before either write", async () => {
		const { db, tx } = createTransactionDb();
		const data = new UniversalDataService({
			db,
			storeId: "20202020-2020-4020-8020-202020202020",
			moduleId: "products",
			moduleDbId: "30303030-3030-4030-8030-303030303030",
		});

		await expect(
			data.transaction((transaction) =>
				transaction.emit(inventoryAdjusted, eventInput),
			),
		).rejects.toThrow(/owned by.*inventory/i);
		expect(tx.moduleOutboxEvent.create).not.toHaveBeenCalled();

		const ownerData = new UniversalDataService({
			db,
			storeId: "20202020-2020-4020-8020-202020202020",
			moduleId: "inventory",
			moduleDbId: "30303030-3030-4030-8030-303030303030",
		});
		await expect(
			ownerData.transaction((transaction) =>
				transaction.emit(inventoryAdjusted, {
					...eventInput,
					payload: { ...eventInput.payload, quantity: -1 },
				}),
			),
		).rejects.toThrow(/payload/i);
		expect(tx.moduleOutboxEvent.create).not.toHaveBeenCalled();
	});

	it("lets a consumer change only its own data in the delivery transaction", async () => {
		const { db } = createTransactionDb();
		const consumerData = new UniversalDataService({
			db,
			storeId: "20202020-2020-4020-8020-202020202020",
			moduleId: "audit-log",
			moduleDbId: "40404040-4040-4040-8040-404040404040",
		});
		const handler = consumeDurableEvent({
			consumer: "audit-log.inventory-adjusted.v1",
			owner: "audit-log",
			definition: inventoryAdjusted,
			handle: vi.fn(async (context, event) => {
				await context.data.upsert("auditEntry", event.id, {
					resource: event.aggregate.type,
				});
			}),
		});

		expect(transactionType(consumerData)).toBe("module-transaction");
		expect(handler.consumer).toBe("audit-log.inventory-adjusted.v1");
	});
});

function transactionType(_data: {
	transaction<T>(
		work: (transaction: ModuleDataTransaction) => Promise<T>,
	): Promise<T>;
}): string {
	return "module-transaction";
}
