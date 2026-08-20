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

describe("returns controller — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReturnController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReturnController(mockData);
	});

	// ── State machine: every valid transition ─────────────────────────

	describe("state machine — valid transitions", () => {
		it("requested -> rejected", async () => {
			const r = await controller.create(makeReturn());
			const result = await controller.reject(r.id, "Policy");
			expect(result?.status).toBe("rejected");
			expect(result?.resolvedAt).toBeDefined();
		});

		it("requested -> cancelled", async () => {
			const r = await controller.create(makeReturn());
			const result = await controller.cancel(r.id);
			expect(result?.status).toBe("cancelled");
			expect(result?.resolvedAt).toBeDefined();
		});

		it("approved -> received", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const result = await controller.markReceived(r.id);
			expect(result?.status).toBe("received");
		});

		it("approved -> completed", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const result = await controller.complete(r.id, 2500);
			expect(result?.status).toBe("completed");
			expect(result?.resolvedAt).toBeDefined();
		});

		it("approved -> cancelled", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const result = await controller.cancel(r.id);
			expect(result?.status).toBe("cancelled");
		});

		it("approved -> rejected", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const result = await controller.reject(r.id);
			expect(result?.status).toBe("rejected");
		});

		it("received -> completed", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const result = await controller.complete(r.id, 1000);
			expect(result?.status).toBe("completed");
		});

		it("received -> cancelled", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const result = await controller.cancel(r.id);
			expect(result?.status).toBe("cancelled");
		});

		it("received -> rejected", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const result = await controller.reject(r.id);
			expect(result?.status).toBe("rejected");
		});
	});

	// ── State machine: every invalid transition ───────────────────────

	describe("state machine — invalid transitions", () => {
		it("cannot approve an approved return", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await expect(controller.approve(r.id)).rejects.toThrow(
				'Cannot approve a return with status "approved"',
			);
		});

		it("cannot approve a received return", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			await expect(controller.approve(r.id)).rejects.toThrow(
				'Cannot approve a return with status "received"',
			);
		});

		it("cannot approve a rejected return", async () => {
			const r = await controller.create(makeReturn());
			await controller.reject(r.id);
			await expect(controller.approve(r.id)).rejects.toThrow(
				'Cannot approve a return with status "rejected"',
			);
		});

		it("cannot approve a cancelled return", async () => {
			const r = await controller.create(makeReturn());
			await controller.cancel(r.id);
			await expect(controller.approve(r.id)).rejects.toThrow(
				'Cannot approve a return with status "cancelled"',
			);
		});

		it("cannot approve a completed return", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.complete(r.id, 2500);
			await expect(controller.approve(r.id)).rejects.toThrow(
				'Cannot approve a return with status "completed"',
			);
		});

		it("cannot mark requested as received", async () => {
			const r = await controller.create(makeReturn());
			await expect(controller.markReceived(r.id)).rejects.toThrow(
				'Cannot mark as received a return with status "requested"',
			);
		});

		it("cannot mark received as received again", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			await expect(controller.markReceived(r.id)).rejects.toThrow(
				'Cannot mark as received a return with status "received"',
			);
		});

		it("cannot mark completed as received", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.complete(r.id, 2500);
			await expect(controller.markReceived(r.id)).rejects.toThrow(
				'Cannot mark as received a return with status "completed"',
			);
		});

		it("cannot complete a rejected return", async () => {
			const r = await controller.create(makeReturn());
			await controller.reject(r.id);
			await expect(controller.complete(r.id, 2500)).rejects.toThrow(
				'Cannot complete a return with status "rejected"',
			);
		});

		it("cannot complete a cancelled return", async () => {
			const r = await controller.create(makeReturn());
			await controller.cancel(r.id);
			await expect(controller.complete(r.id, 2500)).rejects.toThrow(
				'Cannot complete a return with status "cancelled"',
			);
		});

		it("cannot reject a rejected return", async () => {
			const r = await controller.create(makeReturn());
			await controller.reject(r.id);
			await expect(controller.reject(r.id)).rejects.toThrow(
				'Cannot reject a return with status "rejected"',
			);
		});

		it("cannot cancel a rejected return", async () => {
			const r = await controller.create(makeReturn());
			await controller.reject(r.id);
			await expect(controller.cancel(r.id)).rejects.toThrow(
				'Cannot cancel a return with status "rejected"',
			);
		});
	});

	// ── Full lifecycle flows ──────────────────────────────────────────

	describe("full lifecycle flows", () => {
		it("requested -> approved -> received -> completed", async () => {
			const r = await controller.create(makeReturn());
			expect(r.status).toBe("requested");

			const approved = await controller.approve(r.id, "Looks valid");
			expect(approved?.status).toBe("approved");
			expect(approved?.adminNotes).toBe("Looks valid");

			const received = await controller.markReceived(r.id);
			expect(received?.status).toBe("received");

			const completed = await controller.complete(r.id, 2500);
			expect(completed?.status).toBe("completed");
			expect(completed?.refundAmount).toBe(2500);
			expect(completed?.resolvedAt).toBeDefined();
		});

		it("completes with zero refund amount in full flow", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const result = await controller.complete(r.id, 0);
			expect(result?.status).toBe("completed");
			expect(result?.refundAmount).toBe(0);
		});

		it("completes with large refund amount", async () => {
			const r = await controller.create(
				makeReturn({
					items: [makeItem({ unitPrice: 99999999, quantity: 100 })],
				}),
			);
			await controller.approve(r.id);
			const result = await controller.complete(r.id, 9999999900);
			expect(result?.refundAmount).toBe(9999999900);
		});
	});

	// ── Multiple returns for same order / customer ────────────────────

	describe("multiple returns", () => {
		it("allows multiple returns for the same order", async () => {
			await controller.create(makeReturn({ reason: "First issue" }));
			await controller.create(makeReturn({ reason: "Second issue" }));
			const results = await controller.getByOrderId("order_1");
			expect(results).toHaveLength(2);
		});

		it("allows multiple returns for the same customer across orders", async () => {
			await controller.create(makeReturn({ orderId: "order_1" }));
			await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.create(makeReturn({ orderId: "order_3" }));
			const results = await controller.getByCustomerId("cust_1");
			expect(results).toHaveLength(3);
		});

		it("different customers see only their own returns", async () => {
			await controller.create(makeReturn({ customerId: "cust_1" }));
			await controller.create(
				makeReturn({ customerId: "cust_2", orderId: "order_2" }),
			);
			await controller.create(
				makeReturn({ customerId: "cust_2", orderId: "order_3" }),
			);

			expect(await controller.getByCustomerId("cust_1")).toHaveLength(1);
			expect(await controller.getByCustomerId("cust_2")).toHaveLength(2);
		});
	});

	// ── updateTracking edge cases ─────────────────────────────────────

	describe("updateTracking — edge cases", () => {
		it("adds tracking on a received return", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const result = await controller.updateTracking(r.id, "TRACK999", "FedEx");
			expect(result?.trackingNumber).toBe("TRACK999");
			expect(result?.trackingCarrier).toBe("FedEx");
		});

		it("overwrites existing tracking number and carrier", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.updateTracking(r.id, "OLD123", "UPS");
			const result = await controller.updateTracking(r.id, "NEW456", "DHL");
			expect(result?.trackingNumber).toBe("NEW456");
			expect(result?.trackingCarrier).toBe("DHL");
		});

		it("updates tracking number without carrier", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const result = await controller.updateTracking(r.id, "TRACK_ONLY");
			expect(result?.trackingNumber).toBe("TRACK_ONLY");
			expect(result?.trackingCarrier).toBeUndefined();
		});

		it("throws when updating tracking on rejected return", async () => {
			const r = await controller.create(makeReturn());
			await controller.reject(r.id);
			await expect(controller.updateTracking(r.id, "TRACK123")).rejects.toThrow(
				'Cannot update tracking for a return with status "rejected"',
			);
		});

		it("throws when updating tracking on cancelled return", async () => {
			const r = await controller.create(makeReturn());
			await controller.cancel(r.id);
			await expect(controller.updateTracking(r.id, "TRACK123")).rejects.toThrow(
				'Cannot update tracking for a return with status "cancelled"',
			);
		});
	});

	// ── getSummary with mixed statuses ────────────────────────────────

	describe("getSummary — mixed statuses", () => {
		it("counts received status under approved bucket", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);

			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(1);
			expect(summary.approved).toBe(1);
			expect(summary.requested).toBe(0);
		});

		it("sums refund amounts only from completed returns", async () => {
			const r1 = await controller.create(makeReturn());
			const r2 = await controller.create(
				makeReturn({
					orderId: "order_2",
					items: [makeItem({ unitPrice: 800 })],
				}),
			);
			await controller.create(makeReturn({ orderId: "order_3" }));

			await controller.approve(r1.id);
			await controller.complete(r1.id, 2500);

			await controller.approve(r2.id);
			await controller.complete(r2.id, 800);

			// r3 stays requested — its refundAmount should not count
			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(3);
			expect(summary.completed).toBe(2);
			expect(summary.totalRefundAmount).toBe(3300);
			expect(summary.requested).toBe(1);
		});

		it("handles many returns across all statuses", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 6; i++) {
				const r = await controller.create(
					makeReturn({ orderId: `order_${i}` }),
				);
				ids.push(r.id);
			}

			// requested: ids[0]
			// approved: ids[1]
			await controller.approve(ids[1]);
			// received (counted as approved): ids[2]
			await controller.approve(ids[2]);
			await controller.markReceived(ids[2]);
			// completed: ids[3]
			await controller.approve(ids[3]);
			await controller.complete(ids[3], 1000);
			// rejected: ids[4]
			await controller.reject(ids[4]);
			// cancelled: ids[5]
			await controller.cancel(ids[5]);

			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(6);
			expect(summary.requested).toBe(1);
			expect(summary.approved).toBe(2); // approved + received
			expect(summary.completed).toBe(1);
			expect(summary.rejected).toBe(1);
			expect(summary.totalRefundAmount).toBe(1000);
		});
	});

	// ── list with combined filters ────────────────────────────────────

	describe("list — combined filters", () => {
		it("filters by status with skip and take", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeReturn({ orderId: `order_${i}` }));
			}

			const page = await controller.list({
				status: "requested",
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
			for (const r of page) {
				expect(r.status).toBe("requested");
			}
		});

		it("returns empty when filtering status that has no matches", async () => {
			await controller.create(makeReturn());
			const results = await controller.list({ status: "completed" });
			expect(results).toHaveLength(0);
		});

		it("list with skip only", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.create(makeReturn({ orderId: `order_${i}` }));
			}
			const results = await controller.list({ skip: 2 });
			expect(results).toHaveLength(2);
		});
	});

	// ── getByCustomerId with skip ─────────────────────────────────────

	describe("getByCustomerId — pagination edge cases", () => {
		it("supports skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeReturn({ orderId: `order_${i}` }));
			}
			const results = await controller.getByCustomerId("cust_1", { skip: 3 });
			expect(results).toHaveLength(2);
		});

		it("filters by status for a customer", async () => {
			const r1 = await controller.create(makeReturn({ orderId: "order_1" }));
			await controller.create(makeReturn({ orderId: "order_2" }));
			await controller.approve(r1.id);

			const approved = await controller.getByCustomerId("cust_1", {
				status: "approved",
			});
			expect(approved).toHaveLength(1);
			expect(approved[0].status).toBe("approved");
		});

		it("returns empty for customer with no returns", async () => {
			await controller.create(makeReturn());
			const results = await controller.getByCustomerId("cust_nonexistent");
			expect(results).toHaveLength(0);
		});
	});

	// ── Item edge cases ───────────────────────────────────────────────

	describe("item edge cases", () => {
		it("creates return with many items", async () => {
			const items = Array.from({ length: 20 }, (_, i) =>
				makeItem({
					orderItemId: `item_${i}`,
					productName: `Product ${i}`,
					unitPrice: 100 * (i + 1),
				}),
			);
			const result = await controller.create(makeReturn({ items }));
			expect(result.items).toHaveLength(20);
			// Sum: 100 + 200 + ... + 2000 = 100 * (1+2+...+20) = 100 * 210 = 21000
			expect(result.refundAmount).toBe(21000);
		});

		it("items with all reason types", async () => {
			const reasons = [
				"damaged",
				"defective",
				"wrong_item",
				"not_as_described",
				"changed_mind",
				"too_small",
				"too_large",
				"other",
			] as const;

			const items = reasons.map((reason, i) =>
				makeItem({
					orderItemId: `item_${i}`,
					productName: `Product ${i}`,
					reason,
				}),
			);
			const result = await controller.create(makeReturn({ items }));
			expect(result.items).toHaveLength(8);
			const resultReasons = result.items.map((item) => item.reason);
			for (const reason of reasons) {
				expect(resultReasons).toContain(reason);
			}
		});

		it("items with all condition types", async () => {
			const conditions = ["unopened", "opened", "used", "damaged"] as const;

			const items = conditions.map((condition, i) =>
				makeItem({
					orderItemId: `item_${i}`,
					productName: `Product ${i}`,
					condition,
				}),
			);
			const result = await controller.create(makeReturn({ items }));
			expect(result.items).toHaveLength(4);
			const resultConditions = result.items.map((item) => item.condition);
			for (const condition of conditions) {
				expect(resultConditions).toContain(condition);
			}
		});

		it("items with sku and notes are preserved", async () => {
			const result = await controller.create(
				makeReturn({
					items: [
						makeItem({
							sku: "SKU-001",
							notes: "Cracked screen visible",
						}),
					],
				}),
			);
			expect(result.items[0].sku).toBe("SKU-001");
			expect(result.items[0].notes).toBe("Cracked screen visible");
		});

		it("items with high quantity compute correct refund", async () => {
			const result = await controller.create(
				makeReturn({
					items: [makeItem({ unitPrice: 350, quantity: 50 })],
				}),
			);
			expect(result.refundAmount).toBe(17500);
		});
	});
});
