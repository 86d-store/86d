import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPreordersController } from "../service-impl";

/**
 * Security regression tests for preorders endpoints.
 *
 * Preorders have store endpoints (place order, view own orders) and admin CRUD.
 * Security focuses on:
 * - Only active + in-date-range campaigns accept orders
 * - Max quantity limits are enforced
 * - Customer preorder listing is scoped to the customer
 * - Campaign cancellation cascades to pending/confirmed items
 * - Item status transitions follow strict lifecycle
 * - Cancelled items restore campaign quantity
 */

describe("preorders endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPreordersController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);
	const farFuture = new Date(Date.now() + 86400_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPreordersController(mockData);
	});

	describe("campaign accepting orders", () => {
		it("draft campaigns do not accept orders", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: future,
				estimatedShipDate: farFuture,
			});

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			expect(result).toBeNull();
		});

		it("paused campaigns do not accept orders", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			await controller.pauseCampaign(campaign.id);

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			expect(result).toBeNull();
		});

		it("completed campaigns do not accept orders", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			await controller.completeCampaign(campaign.id);

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			expect(result).toBeNull();
		});

		it("active campaign within date range accepts orders", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			expect(result).not.toBeNull();
			expect(result?.status).toBe("pending");
		});

		it("active campaign past end date does not accept orders", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: new Date(Date.now() - 7200_000),
				endDate: past,
				estimatedShipDate: farFuture,
			});

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			expect(result).toBeNull();
		});
	});

	describe("max quantity enforcement", () => {
		it("rejects order exceeding max quantity", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				maxQuantity: 5,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 3,
			});

			// This would exceed max (3 + 3 = 6 > 5)
			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_2",
				customerEmail: "test2@example.com",
				quantity: 3,
			});

			expect(result).toBeNull();
		});

		it("accepts order at exact max quantity", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				maxQuantity: 5,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const result = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 5,
			});

			expect(result).not.toBeNull();
		});
	});

	describe("customer scoping", () => {
		it("getCustomerPreorders only returns that customer's items", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "a@example.com",
				quantity: 1,
			});
			await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_2",
				customerEmail: "b@example.com",
				quantity: 2,
			});

			const cust1Orders = await controller.getCustomerPreorders("cust_1");
			expect(cust1Orders).toHaveLength(1);

			const cust2Orders = await controller.getCustomerPreorders("cust_2");
			expect(cust2Orders).toHaveLength(1);
		});
	});

	describe("campaign cancellation cascade", () => {
		it("cancelling a campaign cancels pending and confirmed items", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			await controller.cancelCampaign(campaign.id, "Out of stock");

			const cancelledItem = await controller.getPreorderItem(item?.id ?? "");
			expect(cancelledItem?.status).toBe("cancelled");
			expect(cancelledItem?.cancelReason).toBe("Out of stock");
		});

		it("cancelling a completed campaign is a no-op", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			await controller.completeCampaign(campaign.id);

			const result = await controller.cancelCampaign(campaign.id);
			expect(result?.status).toBe("completed");
		});
	});

	describe("item status transitions", () => {
		it("fulfillPreorderItem only works on confirmed or ready items", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			// Can't fulfill a pending item
			const result = await controller.fulfillPreorderItem(item?.id ?? "");
			expect(result).toBeNull();
		});

		it("markReady only works on confirmed items", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 1,
			});

			// Can't mark pending item as ready
			const result = await controller.markReady(item?.id ?? "");
			expect(result).toBeNull();
		});

		it("cancelling an item restores campaign quantity", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				maxQuantity: 5,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 3,
			});

			const campaignBefore = await controller.getCampaign(campaign.id);
			expect(campaignBefore?.currentQuantity).toBe(3);

			await controller.cancelPreorderItem(item?.id ?? "", "Changed mind");

			const campaignAfter = await controller.getCampaign(campaign.id);
			expect(campaignAfter?.currentQuantity).toBe(0);
		});
	});

	describe("deposit calculation", () => {
		it("full payment type charges total price", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 2,
			});

			expect(item?.depositPaid).toBe(10000);
			expect(item?.totalPrice).toBe(10000);
		});

		it("deposit payment type charges deposit amount", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "deposit",
				price: 5000,
				depositAmount: 1000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const item = await controller.placePreorder({
				campaignId: campaign.id,
				customerId: "cust_1",
				customerEmail: "test@example.com",
				quantity: 2,
			});

			expect(item?.depositPaid).toBe(2000); // 1000 * 2
			expect(item?.totalPrice).toBe(10000);
		});
	});

	describe("storefront campaign visibility", () => {
		it("getActiveCampaignForProduct returns null for inactive campaigns", async () => {
			const campaign = await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});
			await controller.pauseCampaign(campaign.id);

			const result = await controller.getActiveCampaignForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("getActiveCampaignForProduct returns active in-range campaign", async () => {
			await controller.createCampaign({
				productId: "prod_1",
				productName: "Widget",
				paymentType: "full",
				price: 5000,
				startDate: past,
				estimatedShipDate: farFuture,
			});

			const result = await controller.getActiveCampaignForProduct("prod_1");
			expect(result).not.toBeNull();
			expect(result?.productId).toBe("prod_1");
		});
	});
});
