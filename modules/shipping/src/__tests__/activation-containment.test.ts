import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import shipping from "../index";
import { createShippingController } from "../service-impl";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("shipping activation containment", () => {
	it("does not expose provider quote or label purchase to shopper-facing routes", () => {
		const routes =
			shipping({
				easypostApiKey: "EZTK_test",
				easypostWebhookSecret: "whsec_test",
			}).endpoints?.store ?? {};

		expect(routes).not.toHaveProperty("/shipping/purchase-label");
		expect(routes).not.toHaveProperty("/shipping/live-rates");
		expect(routes).toHaveProperty("/shipping/calculate");
		expect(routes).toHaveProperty("/shipping/track/:id");
	});

	it("fails closed before provider or database effects when label purchase is retried", async () => {
		const data = createMockDataService();
		const get = vi.spyOn(data, "get");
		const upsert = vi.spyOn(data, "upsert");
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("{}", { status: 200 }));
		const controller = createShippingController(data, undefined, {
			easypostApiKey: "EZTK_test",
		});
		const request = {
			shipmentId: "shipment-1",
			easypostShipmentId: "shp_1",
			easypostRateId: "rate_1",
		};

		await expect(controller.purchaseLabel(request)).rejects.toThrow(
			"Shipping label purchase is unavailable",
		);
		await expect(controller.purchaseLabel(request)).rejects.toThrow(
			"Shipping label purchase is unavailable",
		);
		expect(fetch).not.toHaveBeenCalled();
		expect(get).not.toHaveBeenCalled();
		expect(upsert).not.toHaveBeenCalled();
	});
});
