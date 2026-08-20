import type {
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { createMockDataService } from "@86d-app/core/test-utils";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	executeInventoryReservation,
	type InventoryReservationRequest,
} from "../reservations";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function transactionRunner(data: ModuleDataService) {
	let queue = Promise.resolve();
	const transaction: ModuleDataTransaction = {
		get: data.get.bind(data),
		upsert: data.upsert.bind(data),
		delete: data.delete.bind(data),
		findMany: data.findMany.bind(data),
		async emit(definition, input) {
			return {
				id: crypto.randomUUID(),
				name: definition.name,
				version: definition.version,
				storeId: "store-1",
				sourceModule: definition.owner,
				aggregate: { ...input.aggregate, sequence: 1 },
				occurredAt: input.occurredAt ?? new Date(),
				payload: input.payload,
			};
		},
	};
	const lockingTransaction = {
		...transaction,
		getForUpdate: data.get.bind(data),
	};
	const transactions: ModuleTransactionRunner = {
		transaction(work) {
			const result = queue.then(() => work(lockingTransaction));
			queue = result.then(
				() => undefined,
				() => undefined,
			);
			return result;
		},
	};
	return transactions;
}

async function seedStock(
	data: ModuleDataService,
	quantity: number,
	options?: { productId?: string; reserved?: number },
) {
	const productId = options?.productId ?? "product-1";
	await data.upsert("inventoryItem", `${productId}:_:_`, {
		id: `${productId}:_:_`,
		productId,
		quantity,
		reserved: options?.reserved ?? 0,
		allowBackorder: false,
		createdAt: NOW,
		updatedAt: NOW,
	});
}

function reserveRequest(options?: {
	checkoutId?: string;
	lineId?: string;
	productId?: string;
	quantity?: number;
	idempotencyKey?: string;
	leaseDurationSeconds?: number;
}) {
	return {
		operation: "reserve",
		checkoutId: options?.checkoutId ?? "checkout-1",
		lineId: options?.lineId ?? "line-1",
		productId: options?.productId ?? "product-1",
		quantity: options?.quantity ?? 1,
		leaseDurationSeconds: options?.leaseDurationSeconds ?? 60,
		idempotencyKey: options?.idempotencyKey ?? "reserve-operation-1",
	} satisfies InventoryReservationRequest;
}

function transitionRequest(
	operation: "commit" | "release" | "expire",
	options?: {
		checkoutId?: string;
		lineId?: string;
		idempotencyKey?: string;
	},
) {
	return {
		operation,
		checkoutId: options?.checkoutId ?? "checkout-1",
		lineId: options?.lineId ?? "line-1",
		idempotencyKey: options?.idempotencyKey ?? `${operation}-operation-1`,
	} satisfies InventoryReservationRequest;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("Inventory checkout reservations", () => {
	it("fails closed without transactional or locking storage", async () => {
		const data = createMockDataService();
		const unlocked: ModuleTransactionRunner = {
			transaction: async (work) => {
				const transaction: ModuleDataTransaction = {
					...data,
					async emit(definition, input) {
						return {
							id: "event-1",
							name: definition.name,
							version: definition.version,
							storeId: "store-1",
							sourceModule: definition.owner,
							aggregate: { ...input.aggregate, sequence: 1 },
							occurredAt: input.occurredAt ?? NOW,
							payload: input.payload,
						};
					},
				};
				return work(transaction);
			},
		};

		expect(
			await executeInventoryReservation(undefined, reserveRequest()),
		).toMatchObject({
			ok: false,
			failure: { code: "TRANSACTION_UNAVAILABLE" },
		});
		expect(
			await executeInventoryReservation(unlocked, reserveRequest()),
		).toMatchObject({
			ok: false,
			failure: { code: "TRANSACTION_UNAVAILABLE" },
		});
	});

	it("uses an explicit tracked-inventory policy", async () => {
		const data = createMockDataService();
		const result = await executeInventoryReservation(
			transactionRunner(data),
			reserveRequest(),
		);

		expect(result).toMatchObject({
			ok: false,
			failure: { code: "INVENTORY_ITEM_NOT_FOUND" },
		});
	});

	it("allows exactly one concurrent reservation for the last unit", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const data = createMockDataService();
		await seedStock(data, 1);
		const transactions = transactionRunner(data);
		const results = await Promise.all([
			executeInventoryReservation(
				transactions,
				reserveRequest({
					checkoutId: "checkout-a",
					lineId: "line-a",
					idempotencyKey: "reserve-checkout-a",
				}),
			),
			executeInventoryReservation(
				transactions,
				reserveRequest({
					checkoutId: "checkout-b",
					lineId: "line-b",
					idempotencyKey: "reserve-checkout-b",
				}),
			),
		]);

		expect(results.filter((result) => result.ok)).toHaveLength(1);
		expect(results.filter((result) => !result.ok)).toEqual([
			expect.objectContaining({
				failure: expect.objectContaining({ code: "INSUFFICIENT_STOCK" }),
			}),
		]);
	});

	it("replays a reservation after restart and rejects changed same-key input", async () => {
		const data = createMockDataService();
		await seedStock(data, 3);
		const first = await executeInventoryReservation(
			transactionRunner(data),
			reserveRequest({ quantity: 2 }),
		);
		const replay = await executeInventoryReservation(
			transactionRunner(data),
			reserveRequest({ quantity: 2 }),
		);
		const conflict = await executeInventoryReservation(
			transactionRunner(data),
			reserveRequest({ quantity: 1 }),
		);
		const remaining = await executeInventoryReservation(
			transactionRunner(data),
			reserveRequest({
				checkoutId: "checkout-2",
				lineId: "line-2",
				idempotencyKey: "reserve-operation-2",
				quantity: 1,
			}),
		);

		expect(first).toMatchObject({ ok: true });
		expect(replay).toEqual(first);
		expect(conflict).toMatchObject({
			ok: false,
			failure: { code: "IDEMPOTENCY_KEY_REUSED" },
		});
		expect(remaining).toMatchObject({ ok: true });
	});

	it("commits once even when retried with the same or a new operation key", async () => {
		const data = createMockDataService();
		await seedStock(data, 5);
		const transactions = transactionRunner(data);
		await executeInventoryReservation(
			transactions,
			reserveRequest({ quantity: 2 }),
		);
		const first = await executeInventoryReservation(
			transactions,
			transitionRequest("commit"),
		);
		const sameKeyReplay = await executeInventoryReservation(
			transactions,
			transitionRequest("commit"),
		);
		const newKeyReplay = await executeInventoryReservation(
			transactions,
			transitionRequest("commit", {
				idempotencyKey: "commit-operation-2",
			}),
		);
		const reserveRemaining = await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-2",
				lineId: "line-2",
				quantity: 3,
				idempotencyKey: "reserve-remaining-stock",
			}),
		);

		expect(first).toMatchObject({
			ok: true,
			decision: { operation: "commit", reservation: { status: "committed" } },
		});
		expect(sameKeyReplay).toEqual(first);
		expect(newKeyReplay).toMatchObject({
			ok: true,
			decision: { reservation: { status: "committed" } },
		});
		expect(reserveRemaining).toMatchObject({ ok: true });
	});

	it("releases once and never creates capacity beyond stock", async () => {
		const data = createMockDataService();
		await seedStock(data, 5);
		const transactions = transactionRunner(data);
		await executeInventoryReservation(
			transactions,
			reserveRequest({ quantity: 2 }),
		);
		const first = await executeInventoryReservation(
			transactions,
			transitionRequest("release"),
		);
		const replay = await executeInventoryReservation(
			transactions,
			transitionRequest("release", {
				idempotencyKey: "release-operation-2",
			}),
		);
		const allStock = await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-2",
				lineId: "line-2",
				quantity: 5,
				idempotencyKey: "reserve-all-stock",
			}),
		);
		const overCapacity = await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-3",
				lineId: "line-3",
				quantity: 1,
				idempotencyKey: "reserve-over-capacity",
			}),
		);

		expect(first).toMatchObject({
			ok: true,
			decision: { reservation: { status: "released" } },
		});
		expect(replay).toMatchObject({ ok: true });
		expect(allStock).toMatchObject({ ok: true });
		expect(overCapacity).toMatchObject({
			ok: false,
			failure: { code: "INSUFFICIENT_STOCK" },
		});
	});

	it("expires only the matching lease and leaves another Checkout reservable", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const data = createMockDataService();
		await seedStock(data, 2);
		const transactions = transactionRunner(data);
		await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-a",
				lineId: "line-a",
				idempotencyKey: "reserve-checkout-a",
				leaseDurationSeconds: 30,
			}),
		);
		await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-b",
				lineId: "line-b",
				idempotencyKey: "reserve-checkout-b",
				leaseDurationSeconds: 120,
			}),
		);

		vi.setSystemTime(new Date(NOW.getTime() + 31_000));
		const expired = await executeInventoryReservation(
			transactions,
			transitionRequest("expire", {
				checkoutId: "checkout-a",
				lineId: "line-a",
				idempotencyKey: "expire-checkout-a",
			}),
		);
		const stillActive = await executeInventoryReservation(
			transactions,
			transitionRequest("commit", {
				checkoutId: "checkout-b",
				lineId: "line-b",
				idempotencyKey: "commit-checkout-b",
			}),
		);
		const replacement = await executeInventoryReservation(
			transactions,
			reserveRequest({
				checkoutId: "checkout-c",
				lineId: "line-c",
				idempotencyKey: "reserve-checkout-c",
			}),
		);

		expect(expired).toMatchObject({
			ok: true,
			decision: { reservation: { status: "expired" } },
		});
		expect(stillActive).toMatchObject({
			ok: true,
			decision: { reservation: { status: "committed" } },
		});
		expect(replacement).toMatchObject({ ok: true });
	});

	it("does not expire an active lease or commit an expired reservation", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const data = createMockDataService();
		await seedStock(data, 1);
		const transactions = transactionRunner(data);
		await executeInventoryReservation(
			transactions,
			reserveRequest({ leaseDurationSeconds: 30 }),
		);
		expect(
			await executeInventoryReservation(
				transactions,
				transitionRequest("expire"),
			),
		).toMatchObject({ ok: false, failure: { code: "LEASE_ACTIVE" } });

		vi.setSystemTime(new Date(NOW.getTime() + 31_000));
		expect(
			await executeInventoryReservation(
				transactions,
				transitionRequest("commit", {
					idempotencyKey: "commit-after-expiry",
				}),
			),
		).toMatchObject({
			ok: false,
			failure: { code: "RESERVATION_EXPIRED" },
		});
		expect(
			await executeInventoryReservation(
				transactions,
				transitionRequest("commit", {
					idempotencyKey: "commit-after-expired-state",
				}),
			),
		).toMatchObject({
			ok: false,
			failure: { code: "RESERVATION_NOT_ACTIVE" },
		});
	});
});
