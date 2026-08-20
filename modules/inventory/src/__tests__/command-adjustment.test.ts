import { inventoryStockAdjustedV2 } from "@86d-app/core/durable-events";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	adjustInventoryStockFromCommand,
	type InventoryStockAdjustContext,
} from "../commands";

const occurredAt = new Date("2026-08-13T15:00:00.000Z");

function commandContext(operationId: string): InventoryStockAdjustContext {
	return {
		executionId: `execution-${operationId}`,
		operationId,
		actor: { type: "account", id: "account-owner" },
		authority: {
			id: "store-membership-owner",
			type: "store_membership",
			role: "owner",
			permissions: ["inventory:write"],
			storeId: "store-1",
		},
		occurredAt,
	};
}

function stockItem(quantity = 10, reserved = 2) {
	return {
		id: "product-1:variant-1:location-1",
		productId: "product-1",
		variantId: "variant-1",
		locationId: "location-1",
		quantity,
		reserved,
		allowBackorder: false,
		createdAt: new Date("2026-08-13T14:00:00.000Z"),
		updatedAt: new Date("2026-08-13T14:00:00.000Z"),
	};
}

const adjustment = {
	productId: "product-1",
	variantId: "variant-1",
	locationId: "location-1",
	delta: -4,
	correlationId: "inventory-adjust-correlation-1",
	causationId: "inventory-adjust-causation-1",
} as const;

describe("inventory.stock.adjust owner operation", () => {
	it("commits the stock change and command-attributed outbox fact together", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		await transactions.data.upsert(
			"inventoryItem",
			"product-1:variant-1:location-1",
			stockItem(),
		);

		const result = await transactions.transaction((transaction) =>
			adjustInventoryStockFromCommand(
				transaction,
				adjustment,
				commandContext("inventory-adjust-operation-1"),
			),
		);

		expect(result).toEqual({
			ok: true,
			outcome: {
				operationId: "inventory-adjust-operation-1",
				correlationId: "inventory-adjust-correlation-1",
				causationId: "inventory-adjust-causation-1",
				productId: "product-1",
				variantId: "variant-1",
				locationId: "location-1",
				requestedDelta: -4,
				appliedDelta: -4,
				quantity: 6,
				reserved: 2,
				available: 4,
			},
		});
		expect(
			await transactions.data.get(
				"inventoryItem",
				"product-1:variant-1:location-1",
			),
		).toMatchObject({ quantity: 6, reserved: 2, updatedAt: occurredAt });
		expect(transactions.emitted).toEqual([
			expect.objectContaining({
				name: inventoryStockAdjustedV2.name,
				version: inventoryStockAdjustedV2.version,
				sourceModule: inventoryStockAdjustedV2.owner,
				payload: expect.objectContaining({
					delta: -4,
					quantity: 6,
					reserved: 2,
					available: 4,
					command: {
						executionId: "execution-inventory-adjust-operation-1",
						operationId: "inventory-adjust-operation-1",
						correlationId: "inventory-adjust-correlation-1",
						causationId: "inventory-adjust-causation-1",
						actor: { type: "account", id: "account-owner" },
						authorityId: "store-membership-owner",
					},
				}),
			}),
		]);
	});

	it("rolls the stock row back when the durable fact cannot commit", async () => {
		const transactions = createMockTransactionRunner({
			storeId: "store-1",
			beforeEmit() {
				throw new Error("outbox unavailable");
			},
		});
		await transactions.data.upsert(
			"inventoryItem",
			"product-1:variant-1:location-1",
			stockItem(),
		);

		await expect(
			transactions.transaction((transaction) =>
				adjustInventoryStockFromCommand(
					transaction,
					adjustment,
					commandContext("inventory-adjust-operation-rollback"),
				),
			),
		).rejects.toThrow("outbox unavailable");
		expect(
			await transactions.data.get(
				"inventoryItem",
				"product-1:variant-1:location-1",
			),
		).toMatchObject({ quantity: 10, reserved: 2 });
		expect(transactions.emitted).toHaveLength(0);
	});

	it("never consumes units held by active reservations", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		await transactions.data.upsert(
			"inventoryItem",
			"product-1:variant-1:location-1",
			stockItem(10, 4),
		);

		const result = await transactions.transaction((transaction) =>
			adjustInventoryStockFromCommand(
				transaction,
				{ ...adjustment, delta: -9 },
				commandContext("inventory-adjust-operation-reserved"),
			),
		);

		expect(result).toMatchObject({
			ok: true,
			outcome: {
				requestedDelta: -9,
				appliedDelta: -6,
				quantity: 4,
				reserved: 4,
				available: 0,
			},
		});
		expect(transactions.emitted[0]?.payload).toMatchObject({
			delta: -6,
			quantity: 4,
			reserved: 4,
			available: 0,
		});
	});

	it("returns not_found without writes or events", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });

		const result = await transactions.transaction((transaction) =>
			adjustInventoryStockFromCommand(
				transaction,
				adjustment,
				commandContext("inventory-adjust-operation-missing"),
			),
		);

		expect(result).toEqual({ ok: false, reason: "not_found" });
		expect(transactions.data.all("inventoryItem")).toEqual([]);
		expect(transactions.emitted).toEqual([]);
	});

	it("rejects malformed stored availability without mutating it", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		await transactions.data.upsert(
			"inventoryItem",
			"product-1:variant-1:location-1",
			stockItem(4, 5),
		);

		const result = await transactions.transaction((transaction) =>
			adjustInventoryStockFromCommand(
				transaction,
				adjustment,
				commandContext("inventory-adjust-operation-invalid"),
			),
		);

		expect(result).toEqual({ ok: false, reason: "invalid_state" });
		expect(
			await transactions.data.get(
				"inventoryItem",
				"product-1:variant-1:location-1",
			),
		).toMatchObject({ quantity: 4, reserved: 5 });
		expect(transactions.emitted).toEqual([]);
	});
});
