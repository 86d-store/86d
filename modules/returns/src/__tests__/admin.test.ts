import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateReturnParams } from "../service";
import { createReturnController } from "../service-impl";

/**
 * Admin workflow tests for the returns module.
 *
 * Covers admin-specific operations: listing, filtering, summary analytics,
 * batch approval/rejection flows, tracking management, and admin notes.
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

describe("returns — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReturnController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReturnController(mockData);
	});

	// ── Admin listing and filtering ────────────────────────────────

	describe("admin list — advanced filtering", () => {
		it("lists all returns across customers", async () => {
			await controller.create(makeReturn({ customerId: "c1", orderId: "o1" }));
			await controller.create(makeReturn({ customerId: "c2", orderId: "o2" }));
			await controller.create(makeReturn({ customerId: "c3", orderId: "o3" }));

			const all = await controller.list({});
			expect(all).toHaveLength(3);
		});

		it("filters by each status type", async () => {
			const r1 = await controller.create(makeReturn({ orderId: "o1" }));
			const r2 = await controller.create(makeReturn({ orderId: "o2" }));
			const r3 = await controller.create(makeReturn({ orderId: "o3" }));
			const r4 = await controller.create(makeReturn({ orderId: "o4" }));
			await controller.create(makeReturn({ orderId: "o5" }));

			await controller.approve(r1.id);
			await controller.approve(r2.id);
			await controller.markReceived(r2.id);
			await controller.approve(r3.id);
			await controller.complete(r3.id, 2500);
			await controller.reject(r4.id);

			expect(await controller.list({ status: "requested" })).toHaveLength(1);
			expect(await controller.list({ status: "approved" })).toHaveLength(1);
			expect(await controller.list({ status: "received" })).toHaveLength(1);
			expect(await controller.list({ status: "completed" })).toHaveLength(1);
			expect(await controller.list({ status: "rejected" })).toHaveLength(1);
		});

		it("paginates with take only", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create(makeReturn({ orderId: `o${i}` }));
			}
			const page = await controller.list({ take: 3 });
			expect(page).toHaveLength(3);
		});

		it("paginates with skip and take", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.create(makeReturn({ orderId: `o${i}` }));
			}
			const page1 = await controller.list({ take: 3, skip: 0 });
			const page2 = await controller.list({ take: 3, skip: 3 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			// IDs should be different between pages
			const ids1 = page1.map((r) => r.id);
			const ids2 = page2.map((r) => r.id);
			for (const id of ids1) {
				expect(ids2).not.toContain(id);
			}
		});

		it("paginates with status filter and take", async () => {
			for (let i = 0; i < 5; i++) {
				const r = await controller.create(makeReturn({ orderId: `o${i}` }));
				if (i < 3) await controller.approve(r.id);
			}
			const approved = await controller.list({ status: "approved", take: 2 });
			expect(approved).toHaveLength(2);
			for (const r of approved) {
				expect(r.status).toBe("approved");
			}
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.create(makeReturn());
			const result = await controller.list({ skip: 100 });
			expect(result).toHaveLength(0);
		});
	});

	// ── Admin notes across transitions ─────────────────────────────

	describe("admin notes", () => {
		it("approve stores admin notes", async () => {
			const r = await controller.create(makeReturn());
			const approved = await controller.approve(r.id, "Verified with photos");
			expect(approved?.adminNotes).toBe("Verified with photos");
		});

		it("reject stores admin notes", async () => {
			const r = await controller.create(makeReturn());
			const rejected = await controller.reject(r.id, "Outside return window");
			expect(rejected?.adminNotes).toBe("Outside return window");
		});

		it("approve without admin notes leaves them undefined", async () => {
			const r = await controller.create(makeReturn());
			const approved = await controller.approve(r.id);
			expect(approved?.adminNotes).toBeUndefined();
		});

		it("reject without admin notes leaves them undefined", async () => {
			const r = await controller.create(makeReturn());
			const rejected = await controller.reject(r.id);
			expect(rejected?.adminNotes).toBeUndefined();
		});
	});

	// ── Admin complete with partial/full refunds ───────────────────

	describe("admin complete — refund variations", () => {
		it("completes with full item refund amount", async () => {
			const r = await controller.create(
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
			expect(r.refundAmount).toBe(3500);
			await controller.approve(r.id);
			const completed = await controller.complete(r.id, 3500);
			expect(completed?.refundAmount).toBe(3500);
		});

		it("completes with partial refund (restocking fee)", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const completed = await controller.complete(r.id, 2000);
			expect(completed?.refundAmount).toBe(2000);
		});

		it("completes with zero refund (exchange only)", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const completed = await controller.complete(r.id, 0);
			expect(completed?.refundAmount).toBe(0);
		});

		it("completes directly from approved (skip received)", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const completed = await controller.complete(r.id, 2500);
			expect(completed?.status).toBe("completed");
		});

		it("completes from received state", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			await controller.markReceived(r.id);
			const completed = await controller.complete(r.id, 2500);
			expect(completed?.status).toBe("completed");
		});
	});

	// ── Summary analytics ──────────────────────────────────────────

	describe("summary — analytics edge cases", () => {
		it("summary on empty database returns zeros", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(0);
			expect(summary.requested).toBe(0);
			expect(summary.approved).toBe(0);
			expect(summary.completed).toBe(0);
			expect(summary.rejected).toBe(0);
			expect(summary.totalRefundAmount).toBe(0);
		});

		it("summary with only requested returns", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create(makeReturn({ orderId: `o${i}` }));
			}
			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(5);
			expect(summary.requested).toBe(5);
			expect(summary.totalRefundAmount).toBe(0);
		});

		it("cancelled returns are not counted in any positive bucket", async () => {
			const r = await controller.create(makeReturn());
			await controller.cancel(r.id);
			const summary = await controller.getSummary();
			expect(summary.totalRequests).toBe(1);
			expect(summary.requested).toBe(0);
			expect(summary.approved).toBe(0);
			expect(summary.completed).toBe(0);
			expect(summary.rejected).toBe(0);
		});

		it("summary refund total excludes overridden amounts before complete", async () => {
			const r = await controller.create(
				makeReturn({
					items: [makeItem({ unitPrice: 5000, quantity: 1 })],
				}),
			);
			expect(r.refundAmount).toBe(5000);
			await controller.approve(r.id);
			// Admin overrides to partial refund
			await controller.complete(r.id, 3000);

			const summary = await controller.getSummary();
			expect(summary.totalRefundAmount).toBe(3000);
		});
	});

	// ── Tracking management ────────────────────────────────────────

	describe("tracking — admin management", () => {
		it("adds tracking to a newly approved return", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const updated = await controller.updateTracking(r.id, "1Z999AA1", "UPS");
			expect(updated?.trackingNumber).toBe("1Z999AA1");
			expect(updated?.trackingCarrier).toBe("UPS");
		});

		it("adds tracking to a requested return", async () => {
			const r = await controller.create(makeReturn());
			const updated = await controller.updateTracking(
				r.id,
				"PREPAID-LABEL-001",
				"USPS",
			);
			expect(updated?.trackingNumber).toBe("PREPAID-LABEL-001");
		});

		it("tracking persists across state transitions", async () => {
			const r = await controller.create(makeReturn());
			await controller.updateTracking(r.id, "TRACK-123", "FedEx");
			await controller.approve(r.id);
			const approved = await controller.getById(r.id);
			expect(approved?.trackingNumber).toBe("TRACK-123");
			expect(approved?.trackingCarrier).toBe("FedEx");
		});
	});

	// ── getById with items ─────────────────────────────────────────

	describe("getById — includes items", () => {
		it("returns items with the return request", async () => {
			const r = await controller.create(
				makeReturn({
					items: [
						makeItem({ orderItemId: "i1", productName: "Alpha" }),
						makeItem({ orderItemId: "i2", productName: "Beta" }),
					],
				}),
			);
			const fetched = await controller.getById(r.id);
			expect(fetched?.items).toHaveLength(2);
			const names = fetched?.items.map((i) => i.productName).sort();
			expect(names).toEqual(["Alpha", "Beta"]);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.getById("does-not-exist");
			expect(result).toBeNull();
		});
	});

	// ── Customer notes and refund methods ──────────────────────────

	describe("customer notes and refund methods", () => {
		it("preserves customer notes", async () => {
			const r = await controller.create(
				makeReturn({ customerNotes: "Please process quickly" }),
			);
			expect(r.customerNotes).toBe("Please process quickly");
		});

		it("supports store_credit refund method", async () => {
			const r = await controller.create(
				makeReturn({ refundMethod: "store_credit" }),
			);
			expect(r.refundMethod).toBe("store_credit");
		});

		it("supports exchange refund method", async () => {
			const r = await controller.create(
				makeReturn({ refundMethod: "exchange" }),
			);
			expect(r.refundMethod).toBe("exchange");
		});

		it("defaults to original_payment", async () => {
			const r = await controller.create(makeReturn());
			expect(r.refundMethod).toBe("original_payment");
		});

		it("supports different currencies", async () => {
			const r = await controller.create(makeReturn({ currency: "EUR" }));
			expect(r.currency).toBe("EUR");
		});

		it("defaults to USD currency", async () => {
			const r = await controller.create(makeReturn());
			expect(r.currency).toBe("USD");
		});
	});

	// ── Timestamps ─────────────────────────────────────────────────

	describe("timestamps", () => {
		it("sets requestedAt and createdAt on creation", async () => {
			const r = await controller.create(makeReturn());
			expect(r.requestedAt).toBeInstanceOf(Date);
			expect(r.createdAt).toBeInstanceOf(Date);
		});

		it("sets resolvedAt on completion", async () => {
			const r = await controller.create(makeReturn());
			await controller.approve(r.id);
			const completed = await controller.complete(r.id, 2500);
			expect(completed?.resolvedAt).toBeInstanceOf(Date);
		});

		it("sets resolvedAt on rejection", async () => {
			const r = await controller.create(makeReturn());
			const rejected = await controller.reject(r.id);
			expect(rejected?.resolvedAt).toBeInstanceOf(Date);
		});

		it("sets resolvedAt on cancellation", async () => {
			const r = await controller.create(makeReturn());
			const cancelled = await controller.cancel(r.id);
			expect(cancelled?.resolvedAt).toBeInstanceOf(Date);
		});

		it("does not set resolvedAt on approval", async () => {
			const r = await controller.create(makeReturn());
			const approved = await controller.approve(r.id);
			expect(approved?.resolvedAt).toBeUndefined();
		});
	});
});
