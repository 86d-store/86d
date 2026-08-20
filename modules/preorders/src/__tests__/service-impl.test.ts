import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { PreorderCampaign, PreorderItem } from "../service";
import { createPreordersController } from "../service-impl";

describe("createPreordersController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPreordersController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPreordersController(mockData);
	});

	// ── helpers ───────────────────────────────────────────────────────────

	const pastDate = new Date("2026-01-01");
	const futureDate = new Date("2026-12-31");
	const farFuture = new Date("2027-06-01");

	async function mustCreateCampaign(
		overrides?: Partial<Parameters<typeof controller.createCampaign>[0]>,
	): Promise<PreorderCampaign> {
		return controller.createCampaign({
			productId: "prod_1",
			productName: "Test Product",
			paymentType: "full",
			price: 49.99,
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

	// ── createCampaign ──────────────────────────────────────────────────

	describe("createCampaign", () => {
		it("creates a campaign with active status when start date is in the past", async () => {
			const campaign = await mustCreateCampaign();
			expect(campaign.id).toBeDefined();
			expect(campaign.productId).toBe("prod_1");
			expect(campaign.productName).toBe("Test Product");
			expect(campaign.status).toBe("active");
			expect(campaign.paymentType).toBe("full");
			expect(campaign.price).toBe(49.99);
			expect(campaign.currentQuantity).toBe(0);
			expect(campaign.createdAt).toBeInstanceOf(Date);
		});

		it("creates a draft campaign when start date is in the future", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			expect(campaign.status).toBe("draft");
		});

		it("stores optional variant fields", async () => {
			const campaign = await mustCreateCampaign({
				variantId: "var_red",
				variantLabel: "Red / Large",
			});
			expect(campaign.variantId).toBe("var_red");
			expect(campaign.variantLabel).toBe("Red / Large");
		});

		it("stores deposit configuration", async () => {
			const campaign = await mustCreateCampaign({
				paymentType: "deposit",
				depositAmount: 10,
				depositPercent: 20,
			});
			expect(campaign.paymentType).toBe("deposit");
			expect(campaign.depositAmount).toBe(10);
			expect(campaign.depositPercent).toBe(20);
		});

		it("stores maxQuantity", async () => {
			const campaign = await mustCreateCampaign({ maxQuantity: 100 });
			expect(campaign.maxQuantity).toBe(100);
		});

		it("stores end date and estimated ship date", async () => {
			const campaign = await mustCreateCampaign({
				endDate: futureDate,
				estimatedShipDate: farFuture,
			});
			expect(campaign.endDate).toEqual(futureDate);
			expect(campaign.estimatedShipDate).toEqual(farFuture);
		});

		it("stores custom message", async () => {
			const campaign = await mustCreateCampaign({
				message: "Available Q2 2027",
			});
			expect(campaign.message).toBe("Available Q2 2027");
		});
	});

	// ── getCampaign ─────────────────────────────────────────────────────

	describe("getCampaign", () => {
		it("returns existing campaign", async () => {
			const created = await mustCreateCampaign();
			const found = await controller.getCampaign(created.id);
			expect(found).not.toBeNull();
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getCampaign("missing");
			expect(found).toBeNull();
		});
	});

	// ── listCampaigns ───────────────────────────────────────────────────

	describe("listCampaigns", () => {
		it("lists all campaigns", async () => {
			await mustCreateCampaign();
			await mustCreateCampaign({
				productId: "prod_2",
				productName: "Other",
			});
			const all = await controller.listCampaigns();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			await mustCreateCampaign(); // active
			await mustCreateCampaign({
				productId: "prod_2",
				productName: "Future",
				startDate: futureDate,
			}); // draft
			const active = await controller.listCampaigns({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].status).toBe("active");
		});

		it("filters by productId", async () => {
			await mustCreateCampaign();
			await mustCreateCampaign({
				productId: "prod_2",
				productName: "Other",
			});
			const result = await controller.listCampaigns({
				productId: "prod_1",
			});
			expect(result).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await mustCreateCampaign({
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page = await controller.listCampaigns({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty when no campaigns", async () => {
			const result = await controller.listCampaigns();
			expect(result).toHaveLength(0);
		});
	});

	// ── updateCampaign ──────────────────────────────────────────────────

	describe("updateCampaign", () => {
		it("updates campaign fields", async () => {
			const campaign = await mustCreateCampaign();
			const updated = await controller.updateCampaign(campaign.id, {
				productName: "Updated Product",
				price: 59.99,
				message: "New message",
			});
			expect(updated?.productName).toBe("Updated Product");
			expect(updated?.price).toBe(59.99);
			expect(updated?.message).toBe("New message");
		});

		it("returns null for non-existent campaign", async () => {
			const result = await controller.updateCampaign("missing", {
				price: 10,
			});
			expect(result).toBeNull();
		});

		it("preserves unchanged fields", async () => {
			const campaign = await mustCreateCampaign({
				message: "Original",
			});
			const updated = await controller.updateCampaign(campaign.id, {
				price: 99.99,
			});
			expect(updated?.message).toBe("Original");
			expect(updated?.productName).toBe("Test Product");
		});

		it("updates payment type to deposit", async () => {
			const campaign = await mustCreateCampaign();
			const updated = await controller.updateCampaign(campaign.id, {
				paymentType: "deposit",
				depositPercent: 25,
			});
			expect(updated?.paymentType).toBe("deposit");
			expect(updated?.depositPercent).toBe(25);
		});
	});

	// ── activateCampaign ────────────────────────────────────────────────

	describe("activateCampaign", () => {
		it("activates a draft campaign", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			expect(campaign.status).toBe("draft");
			const activated = await controller.activateCampaign(campaign.id);
			expect(activated?.status).toBe("active");
		});

		it("activates a paused campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.pauseCampaign(campaign.id);
			const activated = await controller.activateCampaign(campaign.id);
			expect(activated?.status).toBe("active");
		});

		it("returns null for completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.activateCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.activateCampaign("missing");
			expect(result).toBeNull();
		});
	});

	// ── pauseCampaign ───────────────────────────────────────────────────

	describe("pauseCampaign", () => {
		it("pauses an active campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			const paused = await controller.pauseCampaign(campaign.id);
			expect(paused?.status).toBe("paused");
		});

		it("returns null for draft campaign", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			const result = await controller.pauseCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.pauseCampaign("missing");
			expect(result).toBeNull();
		});
	});

	// ── completeCampaign ────────────────────────────────────────────────

	describe("completeCampaign", () => {
		it("completes an active campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			const completed = await controller.completeCampaign(campaign.id);
			expect(completed?.status).toBe("completed");
		});

		it("completes a paused campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.pauseCampaign(campaign.id);
			const completed = await controller.completeCampaign(campaign.id);
			expect(completed?.status).toBe("completed");
		});

		it("returns null for draft campaign", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			const result = await controller.completeCampaign(campaign.id);
			expect(result).toBeNull();
		});

		it("returns null for already completed campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.completeCampaign(campaign.id);
			expect(result).toBeNull();
		});
	});

	// ── cancelCampaign ──────────────────────────────────────────────────

	describe("cancelCampaign", () => {
		it("cancels an active campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			const cancelled = await controller.cancelCampaign(campaign.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels pending preorder items when campaign is cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await controller.cancelCampaign(campaign.id, "Product discontinued");
			const found = await controller.getPreorderItem(item.id);
			expect(found?.status).toBe("cancelled");
			expect(found?.cancelReason).toBe("Product discontinued");
		});

		it("uses default reason when cancelling items", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await controller.cancelCampaign(campaign.id);
			const found = await controller.getPreorderItem(item.id);
			expect(found?.cancelReason).toBe("Campaign cancelled");
		});

		it("returns existing campaign if already cancelled", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.cancelCampaign(campaign.id);
			const second = await controller.cancelCampaign(campaign.id);
			expect(second?.status).toBe("cancelled");
		});

		it("returns existing campaign if already completed", async () => {
			const campaign = await mustCreateActiveCampaign();
			await controller.completeCampaign(campaign.id);
			const result = await controller.cancelCampaign(campaign.id);
			expect(result?.status).toBe("completed");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.cancelCampaign("missing");
			expect(result).toBeNull();
		});
	});

	// ── placePreorder ───────────────────────────────────────────────────

	describe("placePreorder", () => {
		it("places a preorder with full payment", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			expect(item.id).toBeDefined();
			expect(item.campaignId).toBe(campaign.id);
			expect(item.customerId).toBe("cust_1");
			expect(item.customerEmail).toBe("alice@example.com");
			expect(item.quantity).toBe(1);
			expect(item.status).toBe("pending");
			expect(item.depositPaid).toBe(49.99);
			expect(item.totalPrice).toBe(49.99);
			expect(item.createdAt).toBeInstanceOf(Date);
		});

		it("calculates deposit from depositAmount", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositAmount: 10,
				price: 50,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 2 });
			expect(item.depositPaid).toBe(20);
			expect(item.totalPrice).toBe(100);
		});

		it("calculates deposit from depositPercent", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 25,
				price: 100,
			});
			const item = await mustPlacePreorder(campaign.id, { quantity: 1 });
			expect(item.depositPaid).toBe(25);
			expect(item.totalPrice).toBe(100);
		});

		it("falls back to full price for deposit type without amount/percent", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				price: 80,
			});
			const item = await mustPlacePreorder(campaign.id);
			expect(item.depositPaid).toBe(80);
		});

		it("increments campaign currentQuantity", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id, { quantity: 3 });
			const updated = await controller.getCampaign(campaign.id);
			expect(updated?.currentQuantity).toBe(3);
		});

		it("returns null when campaign does not exist", async () => {
			const item = await controller.placePreorder({
				campaignId: "missing",
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});

		it("returns null when campaign is not active", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});

		it("returns null when maxQuantity would be exceeded", async () => {
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

		it("allows preorder within maxQuantity", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 10,
			});
			await mustPlacePreorder(campaign.id, { quantity: 5 });
			const item = await mustPlacePreorder(campaign.id, {
				quantity: 5,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			expect(item).not.toBeNull();
		});

		it("rejects preorder when campaign has ended", async () => {
			const endDate = new Date("2025-01-01");
			const campaign = await mustCreateCampaign({
				startDate: new Date("2024-01-01"),
				endDate,
			});
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "alice@example.com",
				quantity: 1,
			});
			expect(item).toBeNull();
		});
	});

	// ── getPreorderItem ─────────────────────────────────────────────────

	describe("getPreorderItem", () => {
		it("returns existing preorder item", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const found = await controller.getPreorderItem(item.id);
			expect(found).not.toBeNull();
			expect(found?.campaignId).toBe(campaign.id);
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getPreorderItem("missing");
			expect(found).toBeNull();
		});
	});

	// ── listPreorderItems ───────────────────────────────────────────────

	describe("listPreorderItems", () => {
		it("lists all preorder items", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const all = await controller.listPreorderItems();
			expect(all).toHaveLength(2);
		});

		it("filters by campaignId", async () => {
			const c1 = await mustCreateActiveCampaign();
			const c2 = await mustCreateActiveCampaign({
				productId: "prod_2",
				productName: "Other",
			});
			await mustPlacePreorder(c1.id);
			await mustPlacePreorder(c2.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.listPreorderItems({
				campaignId: c1.id,
			});
			expect(result).toHaveLength(1);
		});

		it("filters by status", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelPreorderItem(item.id);
			const pending = await controller.listPreorderItems({
				status: "pending",
			});
			expect(pending).toHaveLength(1);
		});

		it("supports take and skip", async () => {
			const campaign = await mustCreateActiveCampaign();
			for (let i = 0; i < 5; i++) {
				await mustPlacePreorder(campaign.id, {
					customerId: `cust_${i}`,
					customerEmail: `user${i}@example.com`,
				});
			}
			const page = await controller.listPreorderItems({
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── getCustomerPreorders ────────────────────────────────────────────

	describe("getCustomerPreorders", () => {
		it("lists preorders for a specific customer", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			const result = await controller.getCustomerPreorders("cust_1");
			expect(result).toHaveLength(1);
		});

		it("returns empty for customer with no preorders", async () => {
			const result = await controller.getCustomerPreorders("cust_none");
			expect(result).toHaveLength(0);
		});

		it("supports take and skip", async () => {
			await mustCreateActiveCampaign();
			for (let i = 0; i < 5; i++) {
				const c = await mustCreateActiveCampaign({
					productId: `prod_${i + 10}`,
					productName: `P${i}`,
				});
				await mustPlacePreorder(c.id);
			}
			const page = await controller.getCustomerPreorders("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── cancelPreorderItem ──────────────────────────────────────────────

	describe("cancelPreorderItem", () => {
		it("cancels a pending preorder", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const cancelled = await controller.cancelPreorderItem(
				item.id,
				"Changed mind",
			);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
			expect(cancelled?.cancelReason).toBe("Changed mind");
		});

		it("reduces campaign currentQuantity on cancellation", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id, { quantity: 3 });
			await controller.cancelPreorderItem(item.id);
			const updated = await controller.getCampaign(campaign.id);
			expect(updated?.currentQuantity).toBe(0);
		});

		it("returns item unchanged if already fulfilled", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.fulfillPreorderItem(item.id);
			const result = await controller.cancelPreorderItem(item.id);
			expect(result?.status).toBe("fulfilled");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.cancelPreorderItem("missing");
			expect(result).toBeNull();
		});

		it("cancels without reason", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const cancelled = await controller.cancelPreorderItem(item.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.cancelReason).toBeUndefined();
		});
	});

	// ── fulfillPreorderItem ─────────────────────────────────────────────

	describe("fulfillPreorderItem", () => {
		it("fulfills a confirmed preorder", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);

			const fulfilled = await controller.fulfillPreorderItem(
				item.id,
				"ord_123",
			);
			expect(fulfilled?.status).toBe("fulfilled");
			expect(fulfilled?.fulfilledAt).toBeInstanceOf(Date);
			expect(fulfilled?.orderId).toBe("ord_123");
		});

		it("fulfills a ready preorder", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);
			await controller.markReady(item.id);

			const fulfilled = await controller.fulfillPreorderItem(item.id);
			expect(fulfilled?.status).toBe("fulfilled");
		});

		it("returns null for pending preorder", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const result = await controller.fulfillPreorderItem(item.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.fulfillPreorderItem("missing");
			expect(result).toBeNull();
		});
	});

	// ── markReady ───────────────────────────────────────────────────────

	describe("markReady", () => {
		it("marks a confirmed preorder as ready", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);

			const ready = await controller.markReady(item.id);
			expect(ready?.status).toBe("ready");
		});

		it("returns null for pending preorder", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			const result = await controller.markReady(item.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.markReady("missing");
			expect(result).toBeNull();
		});
	});

	// ── notifyCustomers ─────────────────────────────────────────────────

	describe("notifyCustomers", () => {
		it("notifies confirmed customers who haven't been notified", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);

			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(1);
			expect(result.itemIds).toContain(item.id);

			const found = await controller.getPreorderItem(item.id);
			expect(found?.notifiedAt).toBeInstanceOf(Date);
		});

		it("skips already notified customers", async () => {
			const campaign = await mustCreateActiveCampaign();
			const item = await mustPlacePreorder(campaign.id);
			await confirmItem(item.id);

			await controller.notifyCustomers(campaign.id);
			const second = await controller.notifyCustomers(campaign.id);
			expect(second.notified).toBe(0);
		});

		it("skips pending and cancelled items", async () => {
			const campaign = await mustCreateActiveCampaign();
			await mustPlacePreorder(campaign.id); // pending
			const item2 = await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelPreorderItem(item2.id); // cancelled

			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(0);
		});

		it("returns empty when no items in campaign", async () => {
			const campaign = await mustCreateActiveCampaign();
			const result = await controller.notifyCustomers(campaign.id);
			expect(result.notified).toBe(0);
			expect(result.itemIds).toHaveLength(0);
		});
	});

	// ── getSummary ──────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns summary with all counts", async () => {
			const c1 = await mustCreateActiveCampaign();
			await mustCreateActiveCampaign({
				productId: "prod_2",
				productName: "Other",
			});
			const item1 = await mustPlacePreorder(c1.id, {
				quantity: 2,
			});
			await mustPlacePreorder(c1.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelPreorderItem(item1.id);

			const summary = await controller.getSummary();
			expect(summary.totalCampaigns).toBe(2);
			expect(summary.activeCampaigns).toBe(2);
			expect(summary.totalItems).toBe(2);
			expect(summary.pendingItems).toBe(1);
			expect(summary.cancelledItems).toBe(1);
		});

		it("returns empty summary when no data", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalCampaigns).toBe(0);
			expect(summary.activeCampaigns).toBe(0);
			expect(summary.totalItems).toBe(0);
			expect(summary.totalRevenue).toBe(0);
			expect(summary.totalDeposits).toBe(0);
		});

		it("calculates revenue and deposits correctly", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 50,
				price: 100,
			});
			await mustPlacePreorder(campaign.id, { quantity: 2 });
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
				quantity: 1,
			});

			const summary = await controller.getSummary();
			expect(summary.totalRevenue).toBe(300);
			expect(summary.totalDeposits).toBe(150);
		});

		it("excludes cancelled items from revenue", async () => {
			const campaign = await mustCreateActiveCampaign({ price: 100 });
			const item = await mustPlacePreorder(campaign.id);
			await mustPlacePreorder(campaign.id, {
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});
			await controller.cancelPreorderItem(item.id);

			const summary = await controller.getSummary();
			expect(summary.totalRevenue).toBe(100);
		});
	});

	// ── getActiveCampaignForProduct ─────────────────────────────────────

	describe("getActiveCampaignForProduct", () => {
		it("finds active campaign for product", async () => {
			await mustCreateActiveCampaign();
			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).not.toBeNull();
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null for product with no campaign", async () => {
			const found = await controller.getActiveCampaignForProduct("prod_none");
			expect(found).toBeNull();
		});

		it("returns null for product with only draft campaign", async () => {
			await mustCreateCampaign({ startDate: futureDate });
			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).toBeNull();
		});

		it("filters by variantId", async () => {
			await mustCreateActiveCampaign({ variantId: "var_blue" });
			await mustCreateActiveCampaign({
				productId: "prod_1",
				productName: "Test Product",
				variantId: "var_red",
			});
			const found = await controller.getActiveCampaignForProduct(
				"prod_1",
				"var_red",
			);
			expect(found).not.toBeNull();
			expect(found?.variantId).toBe("var_red");
		});

		it("returns null for ended campaign", async () => {
			await mustCreateCampaign({
				startDate: new Date("2024-01-01"),
				endDate: new Date("2025-01-01"),
			});
			const found = await controller.getActiveCampaignForProduct("prod_1");
			expect(found).toBeNull();
		});
	});

	// ── Full lifecycle ──────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("draft → active → paused → active → completed", async () => {
			const campaign = await mustCreateCampaign({
				startDate: futureDate,
			});
			expect(campaign.status).toBe("draft");

			const activated = await controller.activateCampaign(campaign.id);
			expect(activated?.status).toBe("active");

			const paused = await controller.pauseCampaign(campaign.id);
			expect(paused?.status).toBe("paused");

			const reactivated = await controller.activateCampaign(campaign.id);
			expect(reactivated?.status).toBe("active");

			const completed = await controller.completeCampaign(campaign.id);
			expect(completed?.status).toBe("completed");
		});

		it("campaign creation → preorder → confirm → ready → fulfill", async () => {
			const campaign = await mustCreateActiveCampaign({
				paymentType: "deposit",
				depositPercent: 20,
				price: 100,
			});

			const item = await mustPlacePreorder(campaign.id, { quantity: 2 });
			expect(item.status).toBe("pending");
			expect(item.depositPaid).toBe(40);
			expect(item.totalPrice).toBe(200);

			await confirmItem(item.id);

			const ready = await controller.markReady(item.id);
			expect(ready?.status).toBe("ready");

			const fulfilled = await controller.fulfillPreorderItem(
				item.id,
				"ord_456",
			);
			expect(fulfilled?.status).toBe("fulfilled");
			expect(fulfilled?.orderId).toBe("ord_456");
			expect(fulfilled?.fulfilledAt).toBeInstanceOf(Date);
		});

		it("campaign with limit sells out", async () => {
			const campaign = await mustCreateActiveCampaign({
				maxQuantity: 3,
				price: 50,
			});

			await mustPlacePreorder(campaign.id, { quantity: 2 });
			await mustPlacePreorder(campaign.id, {
				quantity: 1,
				customerId: "cust_2",
				customerEmail: "bob@example.com",
			});

			// Campaign is now at capacity
			const updated = await controller.getCampaign(campaign.id);
			expect(updated?.currentQuantity).toBe(3);

			// Next preorder should fail
			const rejected = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_3",
				customerEmail: "carol@example.com",
				quantity: 1,
			});
			expect(rejected).toBeNull();
		});
	});
});
