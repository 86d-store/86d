import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUberDirectController } from "../service-impl";

/**
 * Store endpoint integration tests for the uber-direct module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. request-quote: requests a delivery quote for given addresses (admin only)
 * 2. create-delivery: creates a delivery from an accepted quote (admin only)
 * 3. get-delivery: retrieves delivery status and tracking info (admin only)
 * 4. check-availability: checks delivery availability by coordinates (public)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Fetch mock helpers ─────────────────────────────────────────────────

const MOCK_TOKEN = {
	access_token: "test_token",
	expires_in: 2592000,
	token_type: "Bearer",
	scope: "eats.deliveries",
};

let fetchSpy: ReturnType<typeof vi.fn>;
let tokenFetched = false;

function mockFetchResponse(status: number, body: unknown) {
	fetchSpy.mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	});
}

function mockApiCall(status: number, body: unknown) {
	if (!tokenFetched) {
		mockFetchResponse(200, MOCK_TOKEN);
		tokenFetched = true;
	}
	mockFetchResponse(status, body);
}

function makeQuoteResponse(id = "dqt_test_1") {
	return {
		kind: "delivery_quote",
		id,
		created: new Date().toISOString(),
		expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
		fee: 799,
		currency: "USD",
		duration: 28,
		pickup_duration: 8,
	};
}

function makeDeliveryResponse(externalId?: string) {
	return {
		id: "del_test_abc",
		status: "pending",
		fee: 799,
		tip: 0,
		tracking_url: "https://uber.com/track/test",
		courier: null,
		external_id: externalId,
	};
}

// ── Simulate endpoint logic ────────────────────────────────────────────

function makeCredentialedController(data: DataService) {
	return createUberDirectController(data, undefined, {
		clientId: "test_client",
		clientSecret: "test_secret",
		customerId: "test_customer",
	});
}

async function simulateRequestQuote(
	data: DataService,
	isAdmin: boolean,
	pickupAddress: Record<string, unknown>,
	dropoffAddress: Record<string, unknown>,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = makeCredentialedController(data);
	const quote = await controller.requestQuote({
		pickupAddress,
		dropoffAddress,
	});
	return { quote };
}

async function simulateCreateDelivery(
	data: DataService,
	isAdmin: boolean,
	params: { orderId: string; quoteId: string; tip?: number },
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = makeCredentialedController(data);
	const delivery = await controller.createDelivery({
		orderId: params.orderId,
		quoteId: params.quoteId,
		tip: params.tip,
	});
	return { delivery };
}

async function simulateGetDelivery(
	data: DataService,
	isAdmin: boolean,
	deliveryId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createUberDirectController(data);
	const delivery = await controller.getDelivery(deliveryId);
	if (!delivery) {
		return { error: "Delivery not found", status: 404 };
	}
	return {
		id: delivery.id,
		orderId: delivery.orderId,
		status: delivery.status,
		trackingUrl: delivery.trackingUrl,
		fee: delivery.fee,
		tip: delivery.tip,
	};
}

// ── Tests: request-quote ───────────────────────────────────────────────

describe("store endpoint: request-quote", () => {
	let data: DataService;

	beforeEach(() => {
		tokenFetched = false;
		data = createMockDataService();
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateRequestQuote(
			data,
			false,
			{ street: "1 Main St" },
			{ street: "2 Elm St" },
		);
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("returns a quote from the Uber Direct API for an admin user", async () => {
		mockApiCall(200, makeQuoteResponse("dqt_admin_quote"));

		const result = await simulateRequestQuote(
			data,
			true,
			{ street: "100 Congress Ave", city: "Austin" },
			{ street: "200 Barton Springs Rd", city: "Austin" },
		);

		expect("quote" in result).toBe(true);
		if ("quote" in result) {
			expect(result.quote.fee).toBe(799);
			expect(result.quote.estimatedMinutes).toBe(28);
			expect(result.quote.status).toBe("active");
		}
	});
});

// ── Tests: create-delivery ─────────────────────────────────────────────

describe("store endpoint: create-delivery", () => {
	let data: DataService;

	beforeEach(() => {
		tokenFetched = false;
		data = createMockDataService();
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateCreateDelivery(data, false, {
			orderId: "ord_1",
			quoteId: "quote_1",
		});
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("creates a delivery from a valid quote", async () => {
		// First, request a quote
		mockApiCall(200, makeQuoteResponse("dqt_for_create"));
		const ctrl = makeCredentialedController(data);
		const quote = await ctrl.requestQuote({
			pickupAddress: { street: "1 Pickup St" },
			dropoffAddress: { street: "2 Dropoff Ave" },
		});

		// Then create the delivery
		tokenFetched = false;
		mockApiCall(200, makeDeliveryResponse("ext_delivery_1"));
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_create",
			quoteId: quote.id,
			tip: 150,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result && result.delivery) {
			expect(result.delivery.orderId).toBe("ord_create");
			expect(result.delivery.status).toBe("pending");
			expect(result.delivery.tip).toBe(150);
		}
	});

	it("uses default tip of 0 when not provided", async () => {
		mockApiCall(200, makeQuoteResponse("dqt_no_tip"));
		const ctrl = makeCredentialedController(data);
		const quote = await ctrl.requestQuote({
			pickupAddress: { street: "3 Oak Ave" },
			dropoffAddress: { street: "4 Pine Rd" },
		});

		tokenFetched = false;
		mockApiCall(200, makeDeliveryResponse());
		const result = await simulateCreateDelivery(data, true, {
			orderId: "ord_notip",
			quoteId: quote.id,
		});

		expect("delivery" in result).toBe(true);
		if ("delivery" in result && result.delivery) {
			expect(result.delivery.tip).toBe(0);
		}
	});
});

// ── Tests: check-availability ─────────────────────────────────────────

describe("store endpoint: check-availability", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns available=false when no service areas are configured", async () => {
		const controller = createUberDirectController(data);
		const result = await controller.checkAvailability({
			lat: 30.267,
			lng: -97.743,
		});
		expect(result.available).toBe(false);
		expect(result.area).toBeUndefined();
	});

	it("returns available=true when coordinates fall within an active service area", async () => {
		const controller = createUberDirectController(data);
		await controller.createServiceArea({
			name: "Austin Downtown",
			centerLat: 30.267,
			centerLng: -97.743,
			radius: 5,
			deliveryFee: 499,
			estimatedMinutes: 35,
		});

		const result = await controller.checkAvailability({
			lat: 30.27,
			lng: -97.74,
		});
		expect(result.available).toBe(true);
		expect(result.area?.name).toBe("Austin Downtown");
		expect(result.area?.deliveryFee).toBe(499);
		expect(result.area?.estimatedMinutes).toBe(35);
	});

	it("returns available=false when coordinates are outside all service areas", async () => {
		const controller = createUberDirectController(data);
		await controller.createServiceArea({
			name: "Austin Downtown",
			centerLat: 30.267,
			centerLng: -97.743,
			radius: 2,
			deliveryFee: 499,
			estimatedMinutes: 35,
		});

		// Dallas is ~300 km away
		const result = await controller.checkAvailability({
			lat: 32.779,
			lng: -96.799,
		});
		expect(result.available).toBe(false);
	});

	it("skips inactive service areas", async () => {
		const controller = createUberDirectController(data);
		await controller.createServiceArea({
			name: "Inactive Zone",
			centerLat: 30.267,
			centerLng: -97.743,
			radius: 100,
			deliveryFee: 299,
			estimatedMinutes: 20,
			isActive: false,
		});

		const result = await controller.checkAvailability({
			lat: 30.267,
			lng: -97.743,
		});
		expect(result.available).toBe(false);
	});

	it("returns the nearest matching active area when multiple areas overlap", async () => {
		const controller = createUberDirectController(data);
		await controller.createServiceArea({
			name: "Small Central",
			centerLat: 30.267,
			centerLng: -97.743,
			radius: 1,
			deliveryFee: 299,
			estimatedMinutes: 20,
		});
		await controller.createServiceArea({
			name: "Large Outer",
			centerLat: 30.267,
			centerLng: -97.743,
			radius: 50,
			deliveryFee: 599,
			estimatedMinutes: 60,
		});

		const result = await controller.checkAvailability({
			lat: 30.267,
			lng: -97.743,
		});
		expect(result.available).toBe(true);
		// First matching area is returned (Small Central)
		expect(result.area?.name).toBe("Small Central");
	});
});

// ── Tests: get-delivery ────────────────────────────────────────────────

describe("store endpoint: get-delivery", () => {
	let data: DataService;

	beforeEach(() => {
		tokenFetched = false;
		data = createMockDataService();
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateGetDelivery(data, false, "dlv_xyz");
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("returns 404 for a non-existent delivery", async () => {
		const result = await simulateGetDelivery(data, true, "dlv_nonexistent");
		expect(result).toMatchObject({ error: "Delivery not found", status: 404 });
	});

	it("returns delivery details for an admin user", async () => {
		// Seed a delivery using the credentialed controller
		mockApiCall(200, makeQuoteResponse("dqt_status"));
		const ctrl = makeCredentialedController(data);
		const quote = await ctrl.requestQuote({
			pickupAddress: { street: "5 Spruce Ct" },
			dropoffAddress: { street: "6 Willow Ln" },
		});

		tokenFetched = false;
		mockApiCall(200, makeDeliveryResponse());
		const created = await ctrl.createDelivery({
			orderId: "ord_status",
			quoteId: quote.id,
		});

		if (!created) throw new Error("Expected delivery to be created");

		const result = await simulateGetDelivery(data, true, created.id);

		expect("id" in result).toBe(true);
		if ("id" in result) {
			expect(result.id).toBe(created.id);
			expect(result.orderId).toBe("ord_status");
			expect(result.status).toBe("pending");
		}
	});
});
