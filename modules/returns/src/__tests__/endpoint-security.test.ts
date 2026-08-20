import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateReturnParams } from "../service";
import { createReturnController } from "../service-impl";

/**
 * Security regression tests for returns endpoints.
 *
 * Returns involve sensitive order/customer data and financial refunds.
 * These tests verify:
 * - Customer isolation: customer A cannot see customer B's returns
 * - Status transition enforcement: invalid state changes are rejected
 * - Refund amount validation: negative amounts, zero amounts, overrides
 * - Double-return prevention: same order can have multiple returns tracked
 * - Item quantity validation: at least one item required
 * - Terminal state immutability: completed/rejected/cancelled returns are locked
 */

const makeItem = (overrides?: Record<string, unknown>) => ({
	orderItemId: "item_1",
	productName: "Widget",
	quantity: 1,
	unitPrice: 2500,
	reason: "damaged" as const,
	...overrides,
});

function makeReturn(
	overrides: Partial<CreateReturnParams> = {},
): CreateReturnParams {
	return {
		orderId: "order_1",
		customerId: "cust_1",
		reason: "Product damaged on arrival",
		items: [makeItem()],
		...overrides,
	};
}

describe("returns endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReturnController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReturnController(mockData);
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getByCustomerId never returns other customers' returns", async () => {
			await controller.create(makeReturn({ customerId: "victim" }));
			await controller.create(
				makeReturn({ customerId: "victim", orderId: "order_2" }),
			);
			await controller.create(
				makeReturn({ customerId: "attacker", orderId: "order_3" }),
			);

			const attackerReturns = await controller.getByCustomerId("attacker");
			expect(attackerReturns).toHaveLength(1);
			for (const ret of attackerReturns) {
				expect(ret.customerId).toBe("attacker");
			}
		});

		it("getByCustomerId with status filter still enforces isolation", async () => {
			const victimReturn = await controller.create(
				makeReturn({ customerId: "victim" }),
			);
			await controller.approve(victimReturn.id);

			await controller.create(
				makeReturn({ customerId: "attacker", orderId: "order_2" }),
			);

			const attackerApproved = await controller.getByCustomerId("attacker", {
				status: "approved",
			});
			expect(attackerApproved).toHaveLength(0);
		});

		it("getByOrderId scopes returns to that order only", async () => {
			await controller.create(makeReturn({ orderId: "order_A" }));
			await controller.create(makeReturn({ orderId: "order_B" }));

			const returnsA = await controller.getByOrderId("order_A");
			expect(returnsA).toHaveLength(1);
			expect(returnsA[0].orderId).toBe("order_A");
		});

		it("getById does not check ownership (endpoint must verify)", async () => {
			const created = await controller.create(
				makeReturn({ customerId: "victim" }),
			);
			// Controller-level getById returns regardless of caller identity.
			// Endpoints MUST verify customerId === session.user.id
			const result = await controller.getById(created.id);
			expect(result).not.toBeNull();
			expect(result?.customerId).toBe("victim");
		});
	});

	// ── Status Transition Enforcement ───────────────────────────────

	describe("status transition enforcement", () => {
		it("cannot approve an already approved return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await expect(controller.approve(created.id)).rejects.toThrow(
				'Cannot approve a return with status "approved"',
			);
		});

		it("cannot approve a completed return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(controller.approve(created.id)).rejects.toThrow(
				'Cannot approve a return with status "completed"',
			);
		});

		it("cannot approve a rejected return", async () => {
			const created = await controller.create(makeReturn());
			await controller.reject(created.id);
			await expect(controller.approve(created.id)).rejects.toThrow(
				'Cannot approve a return with status "rejected"',
			);
		});

		it("cannot mark a requested return as received (must approve first)", async () => {
			const created = await controller.create(makeReturn());
			await expect(controller.markReceived(created.id)).rejects.toThrow(
				'Cannot mark as received a return with status "requested"',
			);
		});

		it("cannot mark a completed return as received", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(controller.markReceived(created.id)).rejects.toThrow(
				'Cannot mark as received a return with status "completed"',
			);
		});

		it("cannot complete a requested return (must approve first)", async () => {
			const created = await controller.create(makeReturn());
			await expect(controller.complete(created.id, 2500)).rejects.toThrow(
				'Cannot complete a return with status "requested"',
			);
		});

		it("cannot complete an already completed return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(controller.complete(created.id, 2500)).rejects.toThrow(
				'Cannot complete a return with status "completed"',
			);
		});
	});

	// ── Terminal State Immutability ─────────────────────────────────

	describe("terminal state immutability", () => {
		const terminalStatuses = ["completed", "rejected", "cancelled"] as const;

		for (const status of terminalStatuses) {
			it(`cannot cancel a ${status} return`, async () => {
				const created = await controller.create(makeReturn());
				if (status === "completed") {
					await controller.approve(created.id);
					await controller.complete(created.id, 2500);
				} else if (status === "rejected") {
					await controller.reject(created.id);
				} else {
					await controller.cancel(created.id);
				}
				await expect(controller.cancel(created.id)).rejects.toThrow(
					`Cannot cancel a return with status "${status}"`,
				);
			});
		}

		for (const status of terminalStatuses) {
			it(`cannot reject a ${status} return`, async () => {
				const created = await controller.create(makeReturn());
				if (status === "completed") {
					await controller.approve(created.id);
					await controller.complete(created.id, 2500);
				} else if (status === "rejected") {
					await controller.reject(created.id);
				} else {
					await controller.cancel(created.id);
				}
				await expect(controller.reject(created.id)).rejects.toThrow(
					`Cannot reject a return with status "${status}"`,
				);
			});
		}

		for (const status of terminalStatuses) {
			it(`cannot update tracking on a ${status} return`, async () => {
				const created = await controller.create(makeReturn());
				if (status === "completed") {
					await controller.approve(created.id);
					await controller.complete(created.id, 2500);
				} else if (status === "rejected") {
					await controller.reject(created.id);
				} else {
					await controller.cancel(created.id);
				}
				await expect(
					controller.updateTracking(created.id, "TRACK123", "UPS"),
				).rejects.toThrow(
					`Cannot update tracking for a return with status "${status}"`,
				);
			});
		}
	});

	// ── Refund Amount Validation ────────────────────────────────────

	describe("refund amount validation", () => {
		it("rejects negative refund amount on complete", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await expect(controller.complete(created.id, -100)).rejects.toThrow(
				"Refund amount cannot be negative",
			);
		});

		it("allows zero refund amount on complete", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.complete(created.id, 0);
			expect(result?.refundAmount).toBe(0);
			expect(result?.status).toBe("completed");
		});

		it("allows overriding refund amount at completion (partial refund)", async () => {
			const created = await controller.create(makeReturn());
			expect(created.refundAmount).toBe(2500);
			await controller.approve(created.id);
			const result = await controller.complete(created.id, 1000);
			expect(result?.refundAmount).toBe(1000);
		});

		it("allows refund amount exceeding original (goodwill override)", async () => {
			const created = await controller.create(makeReturn());
			expect(created.refundAmount).toBe(2500);
			await controller.approve(created.id);
			// Admin may issue a goodwill refund above the item total
			const result = await controller.complete(created.id, 5000);
			expect(result?.refundAmount).toBe(5000);
		});

		it("auto-calculates refund amount from items at creation", async () => {
			const created = await controller.create(
				makeReturn({
					items: [
						makeItem({ unitPrice: 1000, quantity: 3 }),
						makeItem({
							orderItemId: "item_2",
							productName: "Gadget",
							unitPrice: 750,
							quantity: 2,
						}),
					],
				}),
			);
			expect(created.refundAmount).toBe(4500); // 1000*3 + 750*2
		});
	});

	// ── Item Quantity Validation ────────────────────────────────────

	describe("item quantity validation", () => {
		it("rejects return with empty items array", async () => {
			await expect(
				controller.create(makeReturn({ items: [] })),
			).rejects.toThrow("Return must include at least one item");
		});

		it("accepts single item return", async () => {
			const result = await controller.create(
				makeReturn({ items: [makeItem()] }),
			);
			expect(result.items).toHaveLength(1);
		});

		it("accepts multi-item return", async () => {
			const result = await controller.create(
				makeReturn({
					items: [
						makeItem({ orderItemId: "item_1" }),
						makeItem({ orderItemId: "item_2", productName: "Gadget" }),
						makeItem({ orderItemId: "item_3", productName: "Gizmo" }),
					],
				}),
			);
			expect(result.items).toHaveLength(3);
		});
	});

	// ── Double-Return Tracking ─────────────────────────────────────

	describe("double-return prevention tracking", () => {
		it("allows multiple returns for the same order (tracked separately)", async () => {
			const return1 = await controller.create(makeReturn());
			const return2 = await controller.create(
				makeReturn({ reason: "Wrong size" }),
			);

			expect(return1.id).not.toBe(return2.id);
			const orderReturns = await controller.getByOrderId("order_1");
			expect(orderReturns).toHaveLength(2);
		});

		it("summary counts multiple returns for same order correctly", async () => {
			const r1 = await controller.create(makeReturn());
			await controller.create(makeReturn({ reason: "Second issue" }));

			await controller.approve(r1.id);
			await controller.complete(r1.id, 2500);

			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(2);
			expect(summary.completed).toBe(1);
			expect(summary.requested).toBe(1);
			expect(summary.totalRefundAmount).toBe(2500);
		});

		it("cancelling one return does not affect sibling returns", async () => {
			const return1 = await controller.create(makeReturn());
			const return2 = await controller.create(
				makeReturn({ reason: "Different issue" }),
			);

			await controller.cancel(return1.id);

			const r2 = await controller.getById(return2.id);
			expect(r2?.status).toBe("requested");
		});
	});

	// ── Non-existent Resource Handling ──────────────────────────────

	describe("non-existent resource handling", () => {
		it("approve returns null for non-existent return", async () => {
			const result = await controller.approve("nonexistent_id");
			expect(result).toBeNull();
		});

		it("reject returns null for non-existent return", async () => {
			const result = await controller.reject("nonexistent_id");
			expect(result).toBeNull();
		});

		it("complete returns null for non-existent return", async () => {
			const result = await controller.complete("nonexistent_id", 1000);
			expect(result).toBeNull();
		});

		it("cancel returns null for non-existent return", async () => {
			const result = await controller.cancel("nonexistent_id");
			expect(result).toBeNull();
		});

		it("markReceived returns null for non-existent return", async () => {
			const result = await controller.markReceived("nonexistent_id");
			expect(result).toBeNull();
		});

		it("updateTracking returns null for non-existent return", async () => {
			const result = await controller.updateTracking(
				"nonexistent_id",
				"TRACK123",
			);
			expect(result).toBeNull();
		});
	});
});
