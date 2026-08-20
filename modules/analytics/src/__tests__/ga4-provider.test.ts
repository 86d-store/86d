import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GA4Provider } from "../providers/ga4";

const MEASUREMENT_ID = "G-TESTID1234";
const API_SECRET = "test_api_secret";

describe("GA4Provider", () => {
	let provider: GA4Provider;
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		provider = new GA4Provider(MEASUREMENT_ID, API_SECRET);
		fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve(""),
		});
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── mapEvent ──────────────────────────────────────────────────────────

	describe("mapEvent", () => {
		it("maps pageView to GA4 page_view", () => {
			const result = provider.mapEvent({ type: "pageView" });
			expect(result.name).toBe("page_view");
		});

		it("maps productView to GA4 view_item", () => {
			const result = provider.mapEvent({ type: "productView" });
			expect(result.name).toBe("view_item");
		});

		it("maps addToCart to GA4 add_to_cart", () => {
			const result = provider.mapEvent({ type: "addToCart" });
			expect(result.name).toBe("add_to_cart");
		});

		it("maps removeFromCart to GA4 remove_from_cart", () => {
			const result = provider.mapEvent({ type: "removeFromCart" });
			expect(result.name).toBe("remove_from_cart");
		});

		it("maps checkout to GA4 begin_checkout", () => {
			const result = provider.mapEvent({ type: "checkout" });
			expect(result.name).toBe("begin_checkout");
		});

		it("maps purchase to GA4 purchase", () => {
			const result = provider.mapEvent({ type: "purchase" });
			expect(result.name).toBe("purchase");
		});

		it("maps search to GA4 search", () => {
			const result = provider.mapEvent({ type: "search" });
			expect(result.name).toBe("search");
		});

		it("passes through custom event types unchanged", () => {
			const result = provider.mapEvent({ type: "custom_event" });
			expect(result.name).toBe("custom_event");
		});

		it("maps productId to item_id param", () => {
			const result = provider.mapEvent({
				type: "productView",
				productId: "prod_123",
			});
			expect(result.params.item_id).toBe("prod_123");
		});

		it("maps orderId to transaction_id param", () => {
			const result = provider.mapEvent({
				type: "purchase",
				orderId: "ord_456",
			});
			expect(result.params.transaction_id).toBe("ord_456");
		});

		it("converts value from cents to dollars", () => {
			const result = provider.mapEvent({
				type: "purchase",
				value: 4999,
			});
			expect(result.params.value).toBe(49.99);
		});

		it("maps sessionId to session_id param", () => {
			const result = provider.mapEvent({
				type: "pageView",
				sessionId: "sess_abc",
			});
			expect(result.params.session_id).toBe("sess_abc");
		});

		it("includes custom data fields in params", () => {
			const result = provider.mapEvent({
				type: "search",
				data: { query: "shoes", resultCount: 42 },
			});
			expect(result.params.query).toBe("shoes");
			expect(result.params.resultCount).toBe(42);
		});

		it("does not include undefined optional fields", () => {
			const result = provider.mapEvent({ type: "pageView" });
			expect(result.params).not.toHaveProperty("item_id");
			expect(result.params).not.toHaveProperty("transaction_id");
			expect(result.params).not.toHaveProperty("value");
			expect(result.params).not.toHaveProperty("session_id");
		});

		it("handles zero value correctly", () => {
			const result = provider.mapEvent({ type: "purchase", value: 0 });
			expect(result.params.value).toBe(0);
		});
	});

	// ── send ──────────────────────────────────────────────────────────────

	describe("send", () => {
		it("sends a POST request to the Measurement Protocol endpoint", async () => {
			await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});

			expect(fetchSpy).toHaveBeenCalledOnce();
			const [url, options] = fetchSpy.mock.calls[0];
			expect(url).toContain("https://www.google-analytics.com/mp/collect");
			expect(url).toContain(`measurement_id=${MEASUREMENT_ID}`);
			expect(url).toContain(`api_secret=${API_SECRET}`);
			expect(options.method).toBe("POST");
			expect(options.headers).toEqual({
				"Content-Type": "application/json",
			});
		});

		it("includes client_id in the request body", async () => {
			await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});

			const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
			expect(body.client_id).toBe("client_1");
		});

		it("includes user_id when provided", async () => {
			await provider.send({
				clientId: "client_1",
				userId: "user_123",
				events: [{ name: "page_view", params: {} }],
			});

			const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
			expect(body.user_id).toBe("user_123");
		});

		it("omits user_id when not provided", async () => {
			await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});

			const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
			expect(body).not.toHaveProperty("user_id");
		});

		it("includes events array in the request body", async () => {
			const events = [
				{ name: "page_view", params: { page: "/home" } },
				{ name: "view_item", params: { item_id: "prod_1" } },
			];

			await provider.send({ clientId: "client_1", events });

			const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
			expect(body.events).toEqual(events);
		});

		it("returns success on 2xx response", async () => {
			const result = await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});
			expect(result).toEqual({ success: true });
		});

		it("returns error on non-ok response", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: () => Promise.resolve("Bad Request"),
			});

			const result = await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("GA4 Measurement Protocol error");
			expect(result.error).toContain("Bad Request");
		});

		it("handles fetch error in response text gracefully", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.reject(new Error("read failed")),
			});

			const result = await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("HTTP 500");
		});

		it("URL-encodes measurement_id and api_secret", async () => {
			const provider = new GA4Provider("G-TEST&ID", "secret=value");
			await provider.send({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});

			const url = fetchSpy.mock.calls[0][0] as string;
			expect(url).toContain("measurement_id=G-TEST%26ID");
			expect(url).toContain("api_secret=secret%3Dvalue");
		});
	});

	// ── validate ──────────────────────────────────────────────────────────

	describe("validate", () => {
		it("sends to the debug endpoint", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ validationMessages: [] }),
			});

			await provider.validate({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});

			const url = fetchSpy.mock.calls[0][0] as string;
			expect(url).toContain(
				"https://www.google-analytics.com/debug/mp/collect",
			);
		});

		it("returns validation messages from GA4", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						validationMessages: [{ description: "Event name is reserved" }],
					}),
			});

			const result = await provider.validate({
				clientId: "client_1",
				events: [{ name: "reserved_event", params: {} }],
			});
			expect(result.validationMessages).toHaveLength(1);
			expect(result.validationMessages[0].description).toBe(
				"Event name is reserved",
			);
		});

		it("returns empty messages for valid events", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ validationMessages: [] }),
			});

			const result = await provider.validate({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});
			expect(result.validationMessages).toHaveLength(0);
		});

		it("handles non-ok response from debug endpoint", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 403,
			});

			const result = await provider.validate({
				clientId: "client_1",
				events: [{ name: "page_view", params: {} }],
			});
			expect(result.validationMessages).toHaveLength(1);
			expect(result.validationMessages[0].description).toBe("HTTP 403");
		});
	});
});

// ── Integration: controller + provider ───────────────────────────────

describe("analytics controller GA4 integration", () => {
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
			text: () => Promise.resolve(""),
		});
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("forwards tracked events to GA4 when provider is configured", async () => {
		const { createMockDataService } = await import("@86d-app/core/test-utils");
		const { createAnalyticsController } = await import("../service-impl");

		const mockData = createMockDataService();
		const provider = new GA4Provider(MEASUREMENT_ID, API_SECRET);
		const controller = createAnalyticsController(mockData, provider);

		await controller.track({
			type: "purchase",
			customerId: "cust_1",
			orderId: "ord_1",
			value: 4999,
		});

		// Wait for fire-and-forget promise to settle
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(fetchSpy).toHaveBeenCalledOnce();
		const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
		expect(body.client_id).toBe("cust_1");
		expect(body.user_id).toBe("cust_1");
		expect(body.events[0].name).toBe("purchase");
		expect(body.events[0].params.transaction_id).toBe("ord_1");
		expect(body.events[0].params.value).toBe(49.99);
	});

	it("does not call fetch when GA4 provider is not configured", async () => {
		const { createMockDataService } = await import("@86d-app/core/test-utils");
		const { createAnalyticsController } = await import("../service-impl");

		const mockData = createMockDataService();
		const controller = createAnalyticsController(mockData);

		await controller.track({ type: "pageView" });
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("uses sessionId as clientId when customerId is not provided", async () => {
		const { createMockDataService } = await import("@86d-app/core/test-utils");
		const { createAnalyticsController } = await import("../service-impl");

		const mockData = createMockDataService();
		const provider = new GA4Provider(MEASUREMENT_ID, API_SECRET);
		const controller = createAnalyticsController(mockData, provider);

		await controller.track({
			type: "pageView",
			sessionId: "sess_abc",
		});

		await new Promise((resolve) => setTimeout(resolve, 10));

		const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
		expect(body.client_id).toBe("sess_abc");
		expect(body).not.toHaveProperty("user_id");
	});

	it("does not throw when GA4 send fails", async () => {
		const { createMockDataService } = await import("@86d-app/core/test-utils");
		const { createAnalyticsController } = await import("../service-impl");

		fetchSpy.mockRejectedValueOnce(new Error("Network error"));

		const mockData = createMockDataService();
		const provider = new GA4Provider(MEASUREMENT_ID, API_SECRET);
		const controller = createAnalyticsController(mockData, provider);

		// Should not throw — GA4 forwarding is fire-and-forget
		const event = await controller.track({ type: "pageView" });
		expect(event.type).toBe("pageView");
	});

	it("still stores event in DB even when GA4 send fails", async () => {
		const { createMockDataService } = await import("@86d-app/core/test-utils");
		const { createAnalyticsController } = await import("../service-impl");

		fetchSpy.mockRejectedValueOnce(new Error("Network error"));

		const mockData = createMockDataService();
		const provider = new GA4Provider(MEASUREMENT_ID, API_SECRET);
		const controller = createAnalyticsController(mockData, provider);

		await controller.track({ type: "pageView" });
		const events = await controller.listEvents();
		expect(events).toHaveLength(1);
	});
});
