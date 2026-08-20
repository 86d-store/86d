import type {
	AnyDurableEventDefinition,
	DurableEventInput,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { inventoryStockAdjustedV1 } from "@86d-app/core/durable-events";
import { createMockDataService } from "@86d-app/core/test-utils";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { describe, expect, it, vi } from "vitest";
import { inventoryCheckoutProvider } from "../capabilities";
import { createInventoryController } from "../service-impl";

type EmittedEvent = {
	definition: AnyDurableEventDefinition;
	input: DurableEventInput<AnyDurableEventDefinition>;
};

/**
 * A transaction runner that records what committed together. `committed` flips
 * only when the unit of work completes, so a test can tell an atomic commit
 * apart from a partial write.
 */
function recordingRunner(data: ModuleDataService) {
	const emitted: EmittedEvent[] = [];
	const writes: Array<{ entityType: string; entityId: string }> = [];
	let committed = false;
	let rollbacks = 0;

	const runner: ModuleTransactionRunner = {
		transaction: async (work) => {
			const pendingEmits: EmittedEvent[] = [];
			const pendingWrites: typeof writes = [];
			const transaction = {
				get: data.get.bind(data),
				findMany: data.findMany.bind(data),
				delete: data.delete.bind(data),
				upsert: async (
					entityType: string,
					entityId: string,
					value: Record<string, unknown>,
				) => {
					pendingWrites.push({ entityType, entityId });
					await data.upsert(entityType, entityId, value);
				},
				emit: async (
					definition: AnyDurableEventDefinition,
					input: DurableEventInput<AnyDurableEventDefinition>,
				) => {
					const parsed = definition.payload.safeParse(input.payload);
					if (!parsed.success) {
						throw new Error("Durable event payload is invalid.");
					}
					pendingEmits.push({ definition, input });
					return {
						id: "event-1",
						name: definition.name,
						version: definition.version,
						storeId: "store-1",
						sourceModule: definition.owner,
						aggregate: { ...input.aggregate, sequence: 1 },
						occurredAt: input.occurredAt ?? new Date(),
						payload: parsed.data,
					};
				},
			} as unknown as ModuleDataTransaction;

			try {
				const result = await work(transaction);
				emitted.push(...pendingEmits);
				writes.push(...pendingWrites);
				committed = true;
				return result;
			} catch (error) {
				rollbacks++;
				throw error;
			}
		},
	};

	return {
		runner,
		emitted,
		writes,
		get committed() {
			return committed;
		},
		get rollbacks() {
			return rollbacks;
		},
	};
}

describe("adjustStock durable event", () => {
	it("uses the owner transaction runner through the capability provider", async () => {
		const data = createMockDataService();
		const recorder = recordingRunner(data);
		await data.upsert("inventoryItem", "p1:_:_", {
			id: "p1:_:_",
			productId: "p1",
			quantity: 10,
			reserved: 0,
			allowBackorder: false,
			createdAt: new Date("2026-08-13T00:00:00.000Z"),
			updatedAt: new Date("2026-08-13T00:00:00.000Z"),
		});

		const result = await inventoryCheckoutProvider.handle(
			{
				data,
				transactions: recorder.runner,
				storeId: "store-1",
				options: {},
			},
			{ operation: "adjust", productId: "p1", delta: -4 },
		);

		expect(result).toMatchObject({
			ok: true,
			decision: {
				operation: "adjust",
				stock: { quantity: 6, reserved: 0, available: 6 },
			},
		});
		expect(recorder.committed).toBe(true);
		expect(recorder.writes).toEqual([
			{ entityType: "inventoryItem", entityId: "p1:_:_" },
		]);
		expect(recorder.emitted).toHaveLength(1);
		expect(recorder.emitted[0]?.definition).toBe(inventoryStockAdjustedV1);
		expect(recorder.emitted[0]?.input).toMatchObject({
			aggregate: { type: "inventory-item", id: "p1:_:_" },
			payload: {
				productId: "p1",
				delta: -4,
				quantity: 6,
				reserved: 0,
				available: 6,
			},
		});
	});

	it("commits the stock row and inventory.stock-adjusted together", async () => {
		const data = createMockDataService();
		const recorder = recordingRunner(data);
		const controller = createInventoryController(
			data,
			undefined,
			recorder.runner,
		);
		await controller.setStock({ productId: "p1", quantity: 10 });

		const item = await controller.adjustStock({ productId: "p1", delta: -4 });

		expect(item?.quantity).toBe(6);
		expect(recorder.committed).toBe(true);
		expect(recorder.writes).toEqual([
			{ entityType: "inventoryItem", entityId: "p1:_:_" },
		]);
		expect(recorder.emitted).toHaveLength(1);
		expect(recorder.emitted[0]?.definition).toBe(inventoryStockAdjustedV1);
		expect(recorder.emitted[0]?.input).toMatchObject({
			aggregate: { type: "inventory-item", id: "p1:_:_" },
			payload: {
				productId: "p1",
				delta: -4,
				quantity: 6,
				reserved: 0,
				available: 6,
			},
		});
	});

	it("reports the applied delta, not the requested one, when stock clamps at zero", async () => {
		const data = createMockDataService();
		const recorder = recordingRunner(data);
		const controller = createInventoryController(
			data,
			undefined,
			recorder.runner,
		);
		await controller.setStock({ productId: "p1", quantity: 3 });

		const item = await controller.adjustStock({ productId: "p1", delta: -10 });

		expect(item?.quantity).toBe(0);
		// The event must describe what happened to the aggregate. A -10 here
		// would let a consumer derive a negative quantity that never existed.
		expect(recorder.emitted[0]?.input.payload).toMatchObject({
			delta: -3,
			quantity: 0,
			available: 0,
		});
	});

	it("emits nothing when the adjusted item does not exist", async () => {
		const data = createMockDataService();
		const recorder = recordingRunner(data);
		const controller = createInventoryController(
			data,
			undefined,
			recorder.runner,
		);

		const item = await controller.adjustStock({
			productId: "absent",
			delta: 5,
		});

		expect(item).toBeNull();
		expect(recorder.emitted).toEqual([]);
		expect(recorder.writes).toEqual([]);
	});

	it("writes stock without a durable event when the host has no transaction seam", async () => {
		const data = createMockDataService();
		const upsert = vi.spyOn(data, "upsert");
		const controller = createInventoryController(data, undefined, undefined);
		await controller.setStock({ productId: "p1", quantity: 10 });
		upsert.mockClear();

		const item = await controller.adjustStock({ productId: "p1", delta: 2 });

		expect(item?.quantity).toBe(12);
		expect(upsert).toHaveBeenCalledWith(
			"inventoryItem",
			"p1:_:_",
			expect.objectContaining({ quantity: 12 }),
		);
	});

	it("still emits the in-memory notification for unmigrated consumers", async () => {
		const data = createMockDataService();
		const recorder = recordingRunner(data);
		const emitted: string[] = [];
		const events = {
			emit: vi.fn(async (type: string) => {
				emitted.push(type);
			}),
			on: vi.fn(() => () => {}),
			off: vi.fn(),
		};
		const controller = createInventoryController(
			data,
			events as never,
			recorder.runner,
		);
		await controller.setStock({ productId: "p1", quantity: 10 });
		emitted.length = 0;

		await controller.adjustStock({ productId: "p1", delta: 1 });

		// Only the stock-adjusted fact moved to the outbox in this milestone.
		expect(emitted).toContain("inventory.updated");
		expect(recorder.emitted).toHaveLength(1);
	});
});
