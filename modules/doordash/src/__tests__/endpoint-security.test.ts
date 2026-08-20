import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "../admin/endpoints/routes";
import doordash from "../index";
import type { DoordashController } from "../service";
import { createDoordashController } from "../service-impl";
import {
	createStoreEndpoints,
	storeEndpoints,
} from "../store/endpoints/routes";

describe("doordash endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDoordashController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDoordashController(mockData);
	});

	describe("delivery state machine safety", () => {
		it("cannot cancel a delivered delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "o-1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "delivered");
			const result = await controller.cancelDelivery(delivery.id);
			expect(result).toBeNull();
		});

		it("cannot update status after cancellation", async () => {
			const delivery = await controller.createDelivery({
				orderId: "o-2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.cancelDelivery(delivery.id);
			const result = await controller.updateDeliveryStatus(
				delivery.id,
				"accepted",
			);
			expect(result).toBeNull();
		});

		it("get delivery returns null for non-existent id", async () => {
			const result = await controller.getDelivery("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("store endpoints (no credentials)", () => {
		it("omits quote endpoints that require the DoorDash API", () => {
			const routes = Object.keys(storeEndpoints);
			expect(routes).toContain("/doordash/deliveries");
			expect(routes).toContain("/doordash/deliveries/:id");
			expect(routes).toContain("/doordash/availability");
			expect(routes).not.toContain("/doordash/quotes");
			expect(routes).not.toContain("/doordash/quotes/:id/accept");
		});

		it("does not expose webhook without credentials", () => {
			const routes = Object.keys(storeEndpoints);
			expect(routes).not.toContain("/doordash/webhook");
		});
	});

	describe("store endpoints (with credentials)", () => {
		it("keeps all provider-mutating routes disabled with credentials", () => {
			const module = doordash({
				developerId: "developer",
				keyId: "key",
				signingSecret: "secret",
			});
			for (const endpoints of [
				module.endpoints?.store ?? {},
				createStoreEndpoints(),
			]) {
				const routes = Object.keys(endpoints);
				expect(routes).not.toContain("/doordash/quotes");
				expect(routes).not.toContain("/doordash/quotes/:id/accept");
				expect(routes).not.toContain("/doordash/webhook");
				expect(routes).toContain("/doordash/deliveries");
			}
		});

		it("does not construct a provider client or make outbound calls", async () => {
			const fetchSpy = vi
				.spyOn(globalThis, "fetch")
				.mockRejectedValue(new Error("outbound call must remain disabled"));
			try {
				const module = doordash({
					developerId: "developer",
					keyId: "key",
					signingSecret: "secret",
				});
				const initialized = await module.init?.(createMockModuleContext());
				const initializedControllers = initialized?.controllers as
					| { doordash?: DoordashController }
					| undefined;
				const initializedController = initializedControllers?.doordash;
				expect(initializedController).toBeDefined();

				const delivery = await initializedController?.createDelivery({
					orderId: "order-contained",
					pickupAddress: { street: "1 Pickup St" },
					dropoffAddress: { street: "2 Dropoff Ave" },
					fee: 500,
				});

				expect(delivery?.status).toBe("pending");
				expect(fetchSpy).not.toHaveBeenCalled();
			} finally {
				fetchSpy.mockRestore();
			}
		});
	});

	describe("admin endpoints (no credentials)", () => {
		it("always exposes settings so admin UI can show not-configured state", () => {
			const settings = createGetSettingsEndpoint({});
			const endpoints = createAdminEndpointsWithSettings(settings);
			const routes = Object.keys(endpoints);
			expect(routes).toContain("/admin/doordash/settings");
			expect(routes).toContain("/admin/doordash/deliveries");
			expect(routes).toContain("/admin/doordash/zones");
		});
	});

	describe("admin endpoints (with credentials)", () => {
		it("includes settings endpoint with credential info", () => {
			const settings = createGetSettingsEndpoint({
				developerId: "test",
				keyId: "test",
				signingSecret: "test",
			});
			const endpoints = createAdminEndpointsWithSettings(settings);
			const routes = Object.keys(endpoints);
			expect(routes).toContain("/admin/doordash/settings");
			expect(routes).toContain("/admin/doordash/deliveries");
		});
	});

	describe("zone safety", () => {
		it("cannot update non-existent zone", async () => {
			const result = await controller.updateZone("nonexistent", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("cannot delete non-existent zone", async () => {
			const result = await controller.deleteZone("nonexistent");
			expect(result).toBe(false);
		});

		it("deactivated zones are excluded from availability checks", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				radius: 100,
				centerLat: 0,
				centerLng: 0,
				deliveryFee: 5,
				estimatedMinutes: 30,
			});
			await controller.updateZone(zone.id, { isActive: false });

			const result = await controller.checkDeliveryAvailability({
				lat: 0,
				lng: 0,
			});
			expect(result.available).toBe(false);
		});
	});
});
