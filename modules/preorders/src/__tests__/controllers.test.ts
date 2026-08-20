import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { PreorderCampaign, PreorderItem } from "../service";
import { createPreordersController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

describe("preorders controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPreordersController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPreordersController(mockData);
	});

	const pastDate = new Date("2024-01-01");
	const futureDate = new Date("2028-12-31");
	const farFuture = new Date("2029-06-01");

	async function mustCreateCampaign(
		overrides?: Partial<Parameters<typeof controller.createCampaign>[0]>,
	): Promise<PreorderCampaign> {
		return controller.createCampaign({
			productId: "prod_1",
			productName: "Test Product",
			paymentType: "full",
			price: 100,
			startDate: pastDate,
			...overrides,
		});
	}

	async function mustCreateActiveCampaign(
		overrides?: Partial<Parameters<typeof controller.createCampaign>[0]>,
	): Promise<PreorderCampaign> {
		const campaign = await mustCreateCampaign(overrides);
		if (campaign.status !== "active") {
			const activated = await controller.activateCampaign(campaign.id);
			if (!activated) throw new Error("Failed to activate campaign");
			return activated;
		}
		return campaign;
	}

	async function mustPlacePreorder(
		campaignId: string,
		overrides?: Partial<Parameters<typeof controller.placePreorder>[0]>,
	): Promise<PreorderItem> {
		const item = await controller.placePreorder({
			campaignId,
			customerId: "cust_1",
			customerEmail: "alice@example.com",
			quantity: 1,
			...overrides,
		});
		if (!item) throw new Error("Expected preorder to be placed");
		return item;
	}

	async function confirmItem(itemId: string): Promise<void> {
		const existing = await controller.getPreorderItem(itemId);
		if (!existing) throw new Error("Item not found for confirmation");
		const confirmed = { ...existing, status: "confirmed" };
		await mockData.upsert(
			"preorderItem",
			itemId,
			confirmed as Record<string, unknown>,
		);
	}

	async function setItemStatus(itemId: string, status: string): Promise<void> {
		const existing = await controller.getPreorderItem(itemId);
		if (!existing) throw new Error("Item not found for status change");
		const updated = { ...existing, status };
		await mockData.upsert(
			"preorderItem",
			itemId,
			updated as Record<string, unknown>,
		);
	}

	// ── Deposit calculation edge cases ─────────────────────────────────

	describe("deposit calculation edge cases", () => {
		it("depositAmount takes precedence over depositPercent", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositAmount: 15,
				depositPercent: 50,
				price: 100,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 1 });
			// depositAmount is checked first, so 15 * 1 = 15, not 50% of 100 = 50
			expect(item.depositPaid).toBe(15);
		});

		it("depositAmount scales with quantity", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositAmount: 10,
				price: 80,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 4 });
			expect(item.depositPaid).toBe(40);
			expect(item.totalPrice).toBe(320);
		});

		it("depositPercent rounds to two decimal places", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 33,
				price: 10,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 1 });
			// Math.round(10 * 0.33 * 100) / 100 = Math.round(330) / 100 = 3.3
			expect(item.depositPaid).toBe(3.3);
		});

		it("depositPercent with multiple quantity rounds correctly", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 33,
				price: 10,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 3 });
			// totalPrice = 30, deposit = Math.round(30 * 0.33 * 100) / 100 = Math.round(990) / 100 = 9.9
			expect(item.depositPaid).toBe(9.9);
			expect(item.totalPrice).toBe(30);
		});

		it("full payment type returns total price regardless of deposit fields", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "full",
				depositAmount: 10,
				depositPercent: 20,
				price: 100,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 2 });
			expect(item.depositPaid).toBe(200);
			expect(item.totalPrice).toBe(200);
		});
	});

	// ── Campaign status transition edge cases ──────────────────────────

	describe("campaign status transition edge cases", () => {
		it("cannot activate an already active campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			expect(campaign.status).toBe("active");
			// activateCampaign only allows draft or paused
			const result = await controller.activateCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot pause a draft campaign", async () => {
			const campaign = await mustCreateCampaign({ startDate: futureDate });
			expect(campaign.status).toBe("draft");
			const result = await controller.pauseCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot pause a completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.pauseCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot pause a cancelled campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const result = await controller.pauseCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot complete a draft campaign", async () => {
			const campaign = await mustCreateCampaign({ startDate: futureDate });
			const result = await controller.completeCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot complete a cancelled campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const result = await controller.completeCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot activate a cancelled campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const result = await controller.activateCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cannot activate a completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.activateCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("cancel returns existing for already completed campaign unchanged", async () => {
			const campaign = await mustCreateActiveCampaign();
			const completed = unwrap(await controller.completeCampaign(campaign.id));
			const result = unwrap(await controller.cancelCampaign(campaign.id));
			expect(result.status).toBe("completed");
			expect(result.id).toBe(completed.id);
		});

		it("cancel returns existing for already cancelled campaign unchanged", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const result = unwrap(await controller.cancelCampaign(campaign.id));
			expect(result.status).toBe("cancelled");
		});

		it("updatedAt changes on status transitions", async () => {
			const campaign = await mustCreateCampaign({ startDate: futureDate });
			const originalUpdatedAt = campaign.updatedAt;

			const activated = unwrap(await controller.activateCampaign(campaign.id));
			expect(activated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);

			const paused = unwrap(await controller.pauseCampaign(campaign.id));
			expect(paused.updatedAt.getTime()).toBeGreaterThanOrEqual(
				activated.updatedAt.getTime(),
			);
		});
	});

	// ── Campaign cancellation cascading ────────────────────────────────

	describe("campaign cancellation cascading", () => {
		it("cancels both pending and confirmed items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const pendingItem = await mustPlacePreorder(campaign.id);
			const confirmedItem = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(confirmedItem.id);

			await controller.cancelCampaign(campaign.id, "Discontinued");

			const foundPending = unwrap(
				await controller.getPreorderItem(pendingItem.id),
			);
			expect(foundPending.status).toBe("cancelled");
			expect(foundPending.cancelReason).toBe("Discontinued");

			const foundConfirmed = unwrap(
				await controller.getPreorderItem(confirmedItem.id),
			);
			expect(foundConfirmed.status).toBe("cancelled");
			expect(foundConfirmed.cancelReason).toBe("Discontinued");
		});

		it("does not cancel fulfilled items when campaign is cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.fulfillPreorderItem(item.id, "ord_1");

			await controller.cancelCampaign(campaign.id);

			const found = unwrap(await controller.getPreorderItem(item.id));
			expect(found.status).toBe("fulfilled");
		});

		it("does not cancel ready items when campaign is cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.markReady(item.id);

			await controller.cancelCampaign(campaign.id);

			const found = unwrap(await controller.getPreorderItem(item.id));
			expect(found.status).toBe("ready");
		});

		it("does not cancel already cancelled items again", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await controller.cancelPreorderItem(item.id, "Customer request");

			await controller.cancelCampaign(campaign.id, "Bulk cancel");

			const found = unwrap(await controller.getPreorderItem(item.id));
			expect(found.status).toBe("cancelled");
			// Reason should remain the original, not the campaign cancellation reason
			expect(found.cancelReason).toBe("Customer request");
		});

		it("does not cancel refunded items when campaign is cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await setItemStatus(item.id, "refunded");

			await controller.cancelCampaign(campaign.id);

			const found = unwrap(await controller.getPreorderItem(item.id));
			expect(found.status).toBe("refunded");
		});
	});

	// ── Quantity management edge cases ──────────────────────────────────

	describe("quantity management edge cases", () => {
		it("cancelling multiple items reduces quantity correctly", async () => {
			const campaign = await mustCreateActiveCampaign({ maxQuantity: 20 });
			const item1 = await mustPlacePreorder(campaign.id, { quantity: 3 });
			const item2 = await mustPlacePreorder(campaign.id, {
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await mustPlacePreorder(campaign.id, {
				quantity: 2,
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});

			const beforeCancel = unwrap(await controller.getCampaign(campaign.id));
			expect(beforeCancel.currentQuantity).toBe(10);

			await controller.cancelPreorderItem(item1.id);
			await controller.cancelPreorderItem(item2.id);

			const afterCancel = unwrap(await controller.getCampaign(campaign.id));
			expect(afterCancel.currentQuantity).toBe(2);
		});

		it("currentQuantity does not go below zero on cancel", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id, { quantity: 1 });

			// Manually set currentQuantity to 0 to simulate edge case
			const raw = unwrap(await controller.getCampaign(campaign.id));
			await mockData.upsert("preorderCampaign", campaign.id, {
				...raw,
				currentQuantity: 0,
			} as Record<string, unknown>);

			await controller.cancelPreorderItem(item.id);

			const updated = unwrap(await controller.getCampaign(campaign.id));
			expect(updated.currentQuantity).toBe(0);
		});

		it("cancelling an item opens up slot for new preorder", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 2,
				price: 50,
			});
			const item1 = await mustPlacePreorder(campaign.id, { quantity: 1 });
			await mustPlacePreorder(campaign.id, {
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});

			// Campaign is at capacity
			const rejected = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_3",
				customerEmail: "carol@example.com",
				quantity: 1,
			});
			expect(rejected).toBeNull();

			// Cancel one item
			await controller.cancelPreorderItem(item1.id);

			// Now a new order should succeed
			const accepted = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_3",
				customerEmail: "carol@example.com",
				quantity: 1,
			});
			expect(accepted).not.toBeNull();
			expect(accepted?.quantity).toBe(1);
		});

		it("placing exact remaining quantity succeeds", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 5,
			});
			await mustPlacePreorder(campaign.id, { quantity: 3 });

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 2,
			});
			expect(item).not.toBeNull();

			const updated = unwrap(await controller.getCampaign(campaign.id));
			expect(updated.currentQuantity).toBe(5);
		});

		it("placing one over remaining quantity fails", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 5,
			});
			await mustPlacePreorder(campaign.id, { quantity: 3 });

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 3,
			});
			expect(item).toBeNull();
		});

		it("no maxQuantity allows unlimited orders", async () => {
			const campaign = await mustCreateActiveCampaign();
			// Place many orders; should all succeed
			for (let i = 0; i < 10; i++) {
				const item = await mustPlacePreorder(campaign.id, {
					quantity: 100,
					customerId: `cust_${i}`,
					customerEmail: `user${i}@example.com`,
				});
				expect(item).not.toBeNull();
			}
			const updated = unwrap(await controller.getCampaign(campaign.id));
			expect(updated.currentQuantity).toBe(1000);
		});
	});

	// ── Preorder item status transition edge cases ─────────────────────

	describe("preorder item status transition edge cases", () => {
		it("cannot fulfill a pending item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const result = await controller.fulfillPreorderItem(item.id);
			expect(result).toBeNull();
		});

		it("cannot fulfill a cancelled item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await controller.cancelPreorderItem(item.id);
			const result = await controller.fulfillPreorderItem(item.id);
			expect(result).toBeNull();
		});

		it("cannot mark a pending item as ready", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const result = await controller.markReady(item.id);
			expect(result).toBeNull();
		});

		it("cannot mark a ready item as ready again", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.markReady(item.id);
			const result = await controller.markReady(item.id);
			expect(result).toBeNull();
		});

		it("cannot mark a fulfilled item as ready", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.fulfillPreorderItem(item.id);
			const result = await controller.markReady(item.id);
			expect(result).toBeNull();
		});

		it("cannot cancel a fulfilled item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.fulfillPreorderItem(item.id);
			const result = await controller.cancelPreorderItem(item.id);
			expect(result?.status).toBe("fulfilled");
		});

		it("cannot cancel a ready item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.markReady(item.id);
			const result = await controller.cancelPreorderItem(item.id);
			expect(result?.status).toBe("ready");
		});

		it("cannot cancel a refunded item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await setItemStatus(item.id, "refunded");
			const result = await controller.cancelPreorderItem(item.id);
			expect(result?.status).toBe("refunded");
		});

		it("fulfilling without orderId does not set orderId", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			const fulfilled = unwrap(await controller.fulfillPreorderItem(item.id));
			expect(fulfilled.status).toBe("fulfilled");
			expect(fulfilled.orderId).toBeUndefined();
			expect(fulfilled.fulfilledAt).toBeInstanceOf(Date);
		});

		it("fulfilling with orderId stores the orderId", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			const fulfilled = unwrap(
				await controller.fulfillPreorderItem(item.id, "ord_abc"),
			);
			expect(fulfilled.orderId).toBe("ord_abc");
		});
	});

	// ── Notification edge cases ────────────────────────────────────────

	describe("notification edge cases", () => {
		it("notifies multiple confirmed items at once", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item1 = await mustPlacePreorder(campaign.id);
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const item3 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});
			await confirmItem(item1.id);
			await confirmItem(item2.id);
			await confirmItem(item3.id);

			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(3);
			expect(result.itemIds).toHaveLength(3);
			expect(result.itemIds).toContain(item1.id);
			expect(result.itemIds).toContain(item2.id);
			expect(result.itemIds).toContain(item3.id);
		});

		it("notifies ready items as well as confirmed items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item1 = await mustPlacePreorder(campaign.id);
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(item1.id);
			await confirmItem(item2.id);
			await controller.markReady(item2.id);

			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(2);
		});

		it("does not notify pending items", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id);
			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(0);
		});

		it("does not notify cancelled items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.cancelPreorderItem(item.id);
			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(0);
		});

		it("sets notifiedAt on notified items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);

			const before = unwrap(await controller.getPreorderItem(item.id));
			expect(before.notifiedAt).toBeUndefined();

			await controller.notifyCustomers(campaign.id);

			const after = unwrap(await controller.getPreorderItem(item.id));
			expect(after.notifiedAt).toBeInstanceOf(Date);
		});

		it("second notify call does not re-notify already notified items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item1 = await mustPlacePreorder(campaign.id);
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(item1.id);
			await confirmItem(item2.id);

			const first = await controller.notifyCustomers(campaign.id);
			expect(first.notified).toBe(2);

			const second = await controller.notifyCustomers(campaign.id);
			expect(second.notified).toBe(0);
			expect(second.itemIds).toHaveLength(0);
		});

		it("newly confirmed item gets notified on second call", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item1 = await mustPlacePreorder(campaign.id);
			await confirmItem(item1.id);

			await controller.notifyCustomers(campaign.id);

			// New item confirmed after first notification
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(item2.id);

			const second = await controller.notifyCustomers(campaign.id);
			expect(second.notified).toBe(1);
			expect(second.itemIds).toContain(item2.id);
		});

		it("notifyCustomers only targets items in the specified campaign", async () => {
			const c1 = await mustCreateActiveCampaign();
			const c2 = await mustCreateActiveCampaign({
				productId: "prod_2",
				productName: "Other Product",
			});

			const item1 = await mustPlacePreorder(c1.id);
			const item2 = await mustPlacePreorder(c2.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(item1.id);
			await confirmItem(item2.id);

			const result = await controller.notifyCustomers(c1.id);
			expect(result.notified).toBe(1);
			expect(result.itemIds).toContain(item1.id);

			// item2 should not be notified
			const found2 = unwrap(await controller.getPreorderItem(item2.id));
			expect(found2.notifiedAt).toBeUndefined();
		});
	});

	// ── Update campaign edge cases ─────────────────────────────────────

	describe("update campaign edge cases", () => {
		it("updating does not change status", async () => {
			const campaign = await mustCreateActiveCampaign();
			const updated = unwrap(
				await controller.updateCampaign(campaign.id, { price: 999 }),
			);
			expect(updated.status).toBe("active");
		});

		it("updating does not change currentQuantity", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id, { quantity: 5 });
			const updated = unwrap(
				await controller.updateCampaign(campaign.id, {
					maxQuantity: 100,
				}),
			);
			expect(updated.currentQuantity).toBe(5);
		});

		it("updating endDate preserves other fields", async () => {
			const campaign = await mustCreateActiveCampaign({
				message: "Original message",
				estimatedShipDate: farFuture,
			});
			const updated = unwrap(
				await controller.updateCampaign(campaign.id, {
					endDate: futureDate,
				}),
			);
			expect(updated.endDate).toEqual(futureDate);
			expect(updated.message).toBe("Original message");
			expect(updated.estimatedShipDate).toEqual(farFuture);
		});

		it("updating multiple fields at once applies all changes", async () => {
			const campaign = await mustCreateActiveCampaign();
			const updated = unwrap(
				await controller.updateCampaign(campaign.id, {
					productName: "New Name",
					price: 250,
					paymentType: "deposit",
					depositPercent: 30,
					message: "Shipping soon",
				}),
			);
			expect(updated.productName).toBe("New Name");
			expect(updated.price).toBe(250);
			expect(updated.paymentType).toBe("deposit");
			expect(updated.depositPercent).toBe(30);
			expect(updated.message).toBe("Shipping soon");
		});

		it("updates updatedAt timestamp", async () => {
			const campaign = await mustCreateActiveCampaign();
			const updated = unwrap(
				await controller.updateCampaign(campaign.id, { price: 200 }),
			);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				campaign.updatedAt.getTime(),
			);
		});
	});

	// ── getSummary edge cases ──────────────────────────────────────────

	describe("getSummary edge cases", () => {
		it("counts confirmed and ready items together", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item1 = await mustPlacePreorder(campaign.id);
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await confirmItem(item1.id);
			await confirmItem(item2.id);
			await controller.markReady(item2.id);

			const summary = await controller.getSummary();
			expect(summary.confirmedItems).toBe(2); // confirmed + ready
		});

		it("counts refunded items as cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await setItemStatus(item.id, "refunded");

			const summary = await controller.getSummary();
			expect(summary.cancelledItems).toBe(1);
		});

		it("excludes refunded items from revenue and deposits", async () => {
			const campaign = await mustCreateActiveCampaign({ price: 100 });
			const item1 = await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await setItemStatus(item1.id, "refunded");

			const summary = await controller.getSummary();
			expect(summary.totalRevenue).toBe(100);
			expect(summary.totalDeposits).toBe(100);
		});

		it("includes fulfilled items in revenue", async () => {
			const campaign = await mustCreateActiveCampaign({ price: 75 });
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.fulfillPreorderItem(item.id);

			const summary = await controller.getSummary();
			expect(summary.fulfilledItems).toBe(1);
			expect(summary.totalRevenue).toBe(75);
			expect(summary.totalDeposits).toBe(75);
		});

		it("counts multiple campaign statuses correctly", async () => {
			await mustCreateActiveCampaign();
			const c2 = await mustCreateActiveCampaign({
				productId: "prod_2",
				productName: "P2",
			});
			await mustCreateCampaign({
				productId: "prod_3",
				productName: "P3",
				startDate: futureDate,
			});
			await controller.pauseCampaign(c2.id);

			const summary = await controller.getSummary();
			expect(summary.totalCampaigns).toBe(3);
			expect(summary.activeCampaigns).toBe(1);
		});

		it("handles mixed item statuses in a single summary", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 50,
				price: 100,
			});
			await mustPlacePreorder(campaign.id);
			const confirmed = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const cancelled = await mustPlacePreorder(campaign.id, {
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});
			const fulfilled = await mustPlacePreorder(campaign.id, {
				customerId: "cust_4",
				customerEmail: "dave@example.com",
			});
			await confirmItem(confirmed.id);
			await controller.cancelPreorderItem(cancelled.id);
			await confirmItem(fulfilled.id);
			await controller.fulfillPreorderItem(fulfilled.id);

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(4);
			expect(summary.pendingItems).toBe(1);
			expect(summary.confirmedItems).toBe(1);
			expect(summary.fulfilledItems).toBe(1);
			expect(summary.cancelledItems).toBe(1);
			// Revenue: 3 non-cancelled items * 100 = 300
			expect(summary.totalRevenue).toBe(300);
			// Deposits: 3 non-cancelled items * 50 = 150
			expect(summary.totalDeposits).toBe(150);
		});
	});

	// ── getActiveCampaignForProduct edge cases ─────────────────────────

	describe("getActiveCampaignForProduct edge cases", () => {
		it("returns null for paused campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.pauseCampaign(campaign.id);
			const result = await controller.getActiveCampaignForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("returns null for completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.getActiveCampaignForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("returns null for cancelled campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const result = await controller.getActiveCampaignForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("returns campaign without variantId when variantId not specified", async () => {
			await mustCreateActiveCampaign();
			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).not.toBeNull();
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null when active campaign has future startDate", async () => {
			// Create a campaign, then manually adjust it to have a future startDate
			// while keeping active status
			const campaign = await mustCreateActiveCampaign();
			const raw = unwrap(await controller.getCampaign(campaign.id));
			await mockData.upsert("preorderCampaign", campaign.id, {
				...raw,
				startDate: new Date("2030-01-01"),
			} as Record<string, unknown>);

			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).toBeNull();
		});

		it("returns null when active campaign has past endDate", async () => {
			await mustCreateActiveCampaign({
				startDate: new Date("2023-01-01"),
				endDate: new Date("2023-12-31"),
			});

			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).toBeNull();
		});
	});

	// ── Preorder placement on paused/completed/cancelled campaigns ────

	describe("preorder placement on non-active campaigns", () => {
		it("cannot place preorder on paused campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.pauseCampaign(campaign.id);
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});

		it("cannot place preorder on completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});

		it("cannot place preorder on cancelled campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});
	});

	// ── Customer preorders isolation ───────────────────────────────────

	describe("customer preorders isolation", () => {
		it("getCustomerPreorders returns only that customer's items", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_alice",
				customerEmail: "alice@example.com",
			});
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_alice",
				customerEmail: "alice@example.com",
			});
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_bob",
				customerEmail: "bob@example.com",
			});

			const alice = await controller.getCustomerPreorders("cust_alice");
			expect(alice).toHaveLength(2);

			const bob = await controller.getCustomerPreorders("cust_bob");
			expect(bob).toHaveLength(1);

			const nobody = await controller.getCustomerPreorders("cust_nobody");
			expect(nobody).toHaveLength(0);
		});

		it("getCustomerPreorders spans multiple campaigns", async () => {
			const c1 = await mustCreateActiveCampaign();
			const c2 = await mustCreateActiveCampaign({
				productId: "prod_2",
				productName: "Second Product",
			});

			await mustPlacePreorder(c1.id, { customerId: "cust_1" });
			await mustPlacePreorder(c2.id, { customerId: "cust_1" });

			const items = await controller.getCustomerPreorders("cust_1");
			expect(items).toHaveLength(2);
			const campaignIds = items.map((i) => i.campaignId);
			expect(campaignIds).toContain(c1.id);
			expect(campaignIds).toContain(c2.id);
		});
	});

	// ── List filtering edge cases ──────────────────────────────────────

	describe("list filtering edge cases", () => {
		it("listCampaigns with non-matching status returns empty", async () => {
			await mustCreateActiveCampaign();
			const result = await controller.listCampaigns({
				status: "completed",
			});
			expect(result).toHaveLength(0);
		});

		it("listPreorderItems with non-matching campaignId returns empty", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id);
			const result = await controller.listPreorderItems({
				campaignId: "nonexistent",
			});
			expect(result).toHaveLength(0);
		});

		it("listPreorderItems filters by customerId", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id, { customerId: "cust_alice" });
			await mustPlacePreorder(campaign.id, { customerId: "cust_bob" });

			const result = await controller.listPreorderItems({
				customerId: "cust_alice",
			});
			expect(result).toHaveLength(1);
			expect(result[0].customerId).toBe("cust_alice");
		});

		it("listPreorderItems with no params returns all items", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.listPreorderItems();
			expect(result).toHaveLength(2);
		});

		it("listCampaigns with no params returns all campaigns", async () => {
			await mustCreateActiveCampaign();
			await mustCreateCampaign({
				productId: "prod_2",
				productName: "Draft",
				startDate: futureDate,
			});
			const result = await controller.listCampaigns();
			expect(result).toHaveLength(2);
		});
	});

	// ── Full lifecycle scenarios ───────────────────────────────────────

	describe("full lifecycle scenarios", () => {
		it("campaign with deposits: place → confirm → notify → ready → fulfill", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositAmount: 25,
				price: 100,
				endDate: futureDate,
			});

			// Place three preorders
			const item1 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 2,
			});
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 1,
			});
			const item3 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_3",
				customerEmail: "carol@example.com",
				quantity: 1,
			});

			// Verify deposits
			expect(item1.depositPaid).toBe(50);
			expect(item1.totalPrice).toBe(200);
			expect(item2.depositPaid).toBe(25);
			expect(item3.depositPaid).toBe(25);

			// Confirm items
			await confirmItem(item1.id);
			await confirmItem(item2.id);
			await confirmItem(item3.id);

			// Notify all
			const notifyResult = await controller.notifyCustomers(campaign.id);
			expect(notifyResult.notified).toBe(3);

			// Mark ready
			const ready1 = unwrap(await controller.markReady(item1.id));
			expect(ready1.status).toBe("ready");
			const ready2 = unwrap(await controller.markReady(item2.id));
			expect(ready2.status).toBe("ready");
			const ready3 = unwrap(await controller.markReady(item3.id));
			expect(ready3.status).toBe("ready");

			// Fulfill
			const fulfilled1 = unwrap(
				await controller.fulfillPreorderItem(item1.id, "ord_001"),
			);
			expect(fulfilled1.status).toBe("fulfilled");
			expect(fulfilled1.orderId).toBe("ord_001");

			const fulfilled2 = unwrap(
				await controller.fulfillPreorderItem(item2.id, "ord_002"),
			);
			expect(fulfilled2.status).toBe("fulfilled");

			const fulfilled3 = unwrap(
				await controller.fulfillPreorderItem(item3.id, "ord_003"),
			);
			expect(fulfilled3.status).toBe("fulfilled");

			// Complete campaign
			const completed = unwrap(await controller.completeCampaign(campaign.id));
			expect(completed.status).toBe("completed");

			// Verify summary
			const summary = await controller.getSummary();
			expect(summary.totalCampaigns).toBe(1);
			expect(summary.activeCampaigns).toBe(0);
			expect(summary.fulfilledItems).toBe(3);
			expect(summary.totalRevenue).toBe(400);
			expect(summary.totalDeposits).toBe(100);
		});

		it("partial cancellation scenario", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 10,
				price: 50,
			});

			const item1 = await mustPlacePreorder(campaign.id, {
				quantity: 3,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
			});
			const item2 = await mustPlacePreorder(campaign.id, {
				quantity: 4,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await mustPlacePreorder(campaign.id, {
				quantity: 2,
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});

			expect((await controller.getCampaign(campaign.id))?.currentQuantity).toBe(
				9,
			);

			// Cancel item1 with reason
			const cancelled = unwrap(
				await controller.cancelPreorderItem(item1.id, "Out of budget"),
			);
			expect(cancelled.status).toBe("cancelled");
			expect(cancelled.cancelReason).toBe("Out of budget");

			// Quantity should decrease
			expect((await controller.getCampaign(campaign.id))?.currentQuantity).toBe(
				6,
			);

			// Confirm and fulfill item2
			await confirmItem(item2.id);
			const fulfilled = unwrap(
				await controller.fulfillPreorderItem(item2.id, "ord_99"),
			);
			expect(fulfilled.status).toBe("fulfilled");

			// Summary should reflect mixed statuses
			const summary = await controller.getSummary();
			expect(summary.pendingItems).toBe(1);
			expect(summary.fulfilledItems).toBe(1);
			expect(summary.cancelledItems).toBe(1);
			// Revenue excludes cancelled: item2 (200) + item3 (100) = 300
			expect(summary.totalRevenue).toBe(300);
		});

		it("campaign cancel mid-flight preserves fulfilled items", async () => {
			const campaign = await mustCreateActiveCampaign({ price: 100 });

			const fulfilled = await mustPlacePreorder(campaign.id, {
				customerId: "cust_1",
			});
			const pending = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const confirmed = await mustPlacePreorder(campaign.id, {
				customerId: "cust_3",
				customerEmail: "carol@example.com",
			});

			await confirmItem(fulfilled.id);
			await controller.fulfillPreorderItem(fulfilled.id, "ord_1");
			await confirmItem(confirmed.id);

			// Cancel campaign
			await controller.cancelCampaign(campaign.id, "Supply issue");

			// Fulfilled item should be preserved
			const f = unwrap(await controller.getPreorderItem(fulfilled.id));
			expect(f.status).toBe("fulfilled");

			// Pending and confirmed should be cancelled
			const p = unwrap(await controller.getPreorderItem(pending.id));
			expect(p.status).toBe("cancelled");
			expect(p.cancelReason).toBe("Supply issue");

			const c = unwrap(await controller.getPreorderItem(confirmed.id));
			expect(c.status).toBe("cancelled");
			expect(c.cancelReason).toBe("Supply issue");
		});

		it("multiple campaigns for same product at different statuses", async () => {
			// Create campaigns in different states
			const active = await mustCreateActiveCampaign({
				productId: "prod_x",
				productName: "Widget",
				endDate: futureDate,
			});
			const draft = await mustCreateCampaign({
				productId: "prod_x",
				productName: "Widget V2",
				startDate: futureDate,
			});
			const completed = await mustCreateActiveCampaign({
				productId: "prod_x",
				productName: "Widget Legacy",
			});
			await controller.completeCampaign(completed.id);

			// getActiveCampaignForProduct should only find the active one
			const found = await controller.getActiveCampaignForProduct("prod_x");
			expect(found).not.toBeNull();
			expect(found?.id).toBe(active.id);

			// listCampaigns by productId shows all
			const all = await controller.listCampaigns({
				productId: "prod_x",
			});
			expect(all).toHaveLength(3);

			// Filter by status
			const drafts = await controller.listCampaigns({
				productId: "prod_x",
				status: "draft",
			});
			expect(drafts).toHaveLength(1);
			expect(drafts[0].id).toBe(draft.id);
		});
	});
});
