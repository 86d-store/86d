import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReturnController } from "../service-impl";

const makeItem = (overrides?: Record<string, unknown>) => ({
	orderItemId: "item_1",
	productName: "Widget",
	quantity: 1,
	unitPrice: 2500,
	reason: "damaged" as const,
	...overrides,
});

const makeReturn = (overrides?: Record<string, unknown>) => ({
	orderId: "order_1",
	customerId: "cust_1",
	reason: "Product damaged on arrival",
	items: [makeItem()],
	...overrides,
});

describe("createReturnController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReturnController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReturnController(mockData);
	});

	// ── Create ────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a return request with items", async () => {
			const result = await controller.create(makeReturn());
			expect(result.id).toBeDefined();
			expect(result.orderId).toBe("order_1");
			expect(result.customerId).toBe("cust_1");
			expect(result.status).toBe("requested");
			expect(result.refundMethod).toBe("original_payment");
			expect(result.refundAmount).toBe(2500);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].productName).toBe("Widget");
			expect(result.items[0].reason).toBe("damaged");
			expect(result.items[0].condition).toBe("opened");
		});

		it("calculates refund amount from items", async () => {
			const result = await controller.create(
				makeReturn({
					items: [
						makeItem({ unitPrice: 1000, quantity: 2 }),
						makeItem({
							orderItemId: "item_2",
							productName: "Gadget",
							unitPrice: 500,
							quantity: 3,
						}),
					],
				}),
			);
			expect(result.refundAmount).toBe(3500); // 1000*2 + 500*3
		});

		it("accepts custom refund method", async () => {
			const result = await controller.create(
				makeReturn({ refundMethod: "store_credit" }),
			);
			expect(result.refundMethod).toBe("store_credit");
		});

		it("throws when no items provided", async () => {
			await expect(
				controller.create(makeReturn({ items: [] })),
			).rejects.toThrow("Return must include at least one item");
		});

		it("stores customer notes", async () => {
			const result = await controller.create(
				makeReturn({ customerNotes: "Please expedite" }),
			);
			expect(result.customerNotes).toBe("Please expedite");
		});
	});

	// ── GetById ──────────────────────────────────────────────────────

	describe("getById", () => {
		it("returns null for non-existent ID", async () => {
			const result = await controller.getById("missing");
			expect(result).toBeNull();
		});

		it("returns request with items", async () => {
			const created = await controller.create(makeReturn());
			const found = await controller.getById(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.items).toHaveLength(1);
		});
	});

	// ── GetByOrderId ─────────────────────────────────────────────────

	describe("getByOrderId", () => {
		it("returns returns for an order", async () => {
			await controller.create(makeReturn());
			await controller.create(makeReturn({ orderId: "order_2" }));
			const results = await controller.getByOrderId("order_1");
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("order_1");
		});

		it("returns empty array for unknown order", async () => {
			const results = await controller.getByOrderId("unknown");
			expect(results).toHaveLength(0);
		});
	});

	// ── GetByCustomerId ──────────────────────────────────────────────

	describe("getByCustomerId", () => {
		it("returns returns for a customer", async () => {
			await controller.create(makeReturn());
			await controller.create(
				makeReturn({ customerId: "cust_2", orderId: "order_2" }),
			);
			const results = await controller.getByCustomerId("cust_1");
			expect(results).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await controller.create(makeReturn());
			await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.create(makeReturn({ orderId: "order_3" }));

			const page = await controller.getByCustomerId("cust_1", { take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Approve ──────────────────────────────────────────────────────

	describe("approve", () => {
		it("approves a requested return", async () => {
			const created = await controller.create(makeReturn());
			const result = await controller.approve(created.id);
			expect(result?.status).toBe("approved");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.approve("missing");
			expect(result).toBeNull();
		});

		it("stores admin notes", async () => {
			const created = await controller.create(makeReturn());
			const result = await controller.approve(
				created.id,
				"Approved per policy",
			);
			expect(result?.adminNotes).toBe("Approved per policy");
		});

		it("throws when approving non-requested return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await expect(controller.approve(created.id)).rejects.toThrow(
				'Cannot approve a return with status "approved"',
			);
		});
	});

	// ── Reject ───────────────────────────────────────────────────────

	describe("reject", () => {
		it("rejects a requested return", async () => {
			const created = await controller.create(makeReturn());
			const result = await controller.reject(created.id, "Outside policy");
			expect(result?.status).toBe("rejected");
			expect(result?.adminNotes).toBe("Outside policy");
			expect(result?.resolvedAt).toBeDefined();
		});

		it("rejects an approved return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.reject(created.id);
			expect(result?.status).toBe("rejected");
		});

		it("throws when rejecting a completed return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(controller.reject(created.id)).rejects.toThrow(
				'Cannot reject a return with status "completed"',
			);
		});
	});

	// ── MarkReceived ─────────────────────────────────────────────────

	describe("markReceived", () => {
		it("marks approved return as received", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.markReceived(created.id);
			expect(result?.status).toBe("received");
		});

		it("throws when marking non-approved return as received", async () => {
			const created = await controller.create(makeReturn());
			await expect(controller.markReceived(created.id)).rejects.toThrow(
				'Cannot mark as received a return with status "requested"',
			);
		});
	});

	// ── Complete ─────────────────────────────────────────────────────

	describe("complete", () => {
		it("completes an approved return with refund amount", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.complete(created.id, 2000);
			expect(result?.status).toBe("completed");
			expect(result?.refundAmount).toBe(2000);
			expect(result?.resolvedAt).toBeDefined();
		});

		it("completes a received return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.markReceived(created.id);
			const result = await controller.complete(created.id, 2500);
			expect(result?.status).toBe("completed");
		});

		it("throws on negative refund amount", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await expect(controller.complete(created.id, -100)).rejects.toThrow(
				"Refund amount cannot be negative",
			);
		});

		it("throws when completing a requested return", async () => {
			const created = await controller.create(makeReturn());
			await expect(controller.complete(created.id, 2500)).rejects.toThrow(
				'Cannot complete a return with status "requested"',
			);
		});

		it("allows zero refund amount", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.complete(created.id, 0);
			expect(result?.refundAmount).toBe(0);
		});
	});

	// ── Cancel ───────────────────────────────────────────────────────

	describe("cancel", () => {
		it("cancels a requested return", async () => {
			const created = await controller.create(makeReturn());
			const result = await controller.cancel(created.id);
			expect(result?.status).toBe("cancelled");
			expect(result?.resolvedAt).toBeDefined();
		});

		it("cancels an approved return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.cancel(created.id);
			expect(result?.status).toBe("cancelled");
		});

		it("throws when cancelling a completed return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(controller.cancel(created.id)).rejects.toThrow(
				'Cannot cancel a return with status "completed"',
			);
		});

		it("throws when cancelling an already cancelled return", async () => {
			const created = await controller.create(makeReturn());
			await controller.cancel(created.id);
			await expect(controller.cancel(created.id)).rejects.toThrow(
				'Cannot cancel a return with status "cancelled"',
			);
		});
	});

	// ── Tracking ─────────────────────────────────────────────────────

	describe("updateTracking", () => {
		it("updates tracking info on an approved return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			const result = await controller.updateTracking(
				created.id,
				"1Z999AA10123456784",
				"UPS",
			);
			expect(result?.trackingNumber).toBe("1Z999AA10123456784");
			expect(result?.trackingCarrier).toBe("UPS");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateTracking("missing", "TRACK123");
			expect(result).toBeNull();
		});

		it("throws when updating tracking on completed return", async () => {
			const created = await controller.create(makeReturn());
			await controller.approve(created.id);
			await controller.complete(created.id, 2500);
			await expect(
				controller.updateTracking(created.id, "TRACK123"),
			).rejects.toThrow(
				'Cannot update tracking for a return with status "completed"',
			);
		});
	});

	// ── List ─────────────────────────────────────────────────────────

	describe("list", () => {
		it("returns all return requests", async () => {
			await controller.create(makeReturn());
			await controller.create(makeReturn({ orderId: "order_2" }));
			const results = await controller.list();
			expect(results).toHaveLength(2);
		});

		it("filters by status", async () => {
			const r1 = await controller.create(makeReturn());
			await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.approve(r1.id);

			const approved = await controller.list({ status: "approved" });
			expect(approved).toHaveLength(1);
			expect(approved[0].status).toBe("approved");
		});

		it("supports pagination", async () => {
			await controller.create(makeReturn());
			await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.create(makeReturn({ orderId: "order_3" }));

			const page = await controller.list({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Summary ──────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns zero summary for empty store", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(0);
			expect(summary.requested).toBe(0);
			expect(summary.approved).toBe(0);
			expect(summary.completed).toBe(0);
			expect(summary.rejected).toBe(0);
			expect(summary.totalRefundAmount).toBe(0);
		});

		it("calculates correct summary", async () => {
			const r1 = await controller.create(makeReturn());
			const r2 = await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.create(makeReturn({ orderId: "order_3" }));

			await controller.approve(r1.id);
			await controller.complete(r1.id, 2500);

			await controller.reject(r2.id, "Policy violation");

			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(3);
			expect(summary.completed).toBe(1);
			expect(summary.rejected).toBe(1);
			expect(summary.requested).toBe(1);
			expect(summary.totalRefundAmount).toBe(2500);
		});
	});
});
