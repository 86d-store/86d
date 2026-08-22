import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	EasyPostProvider,
	type EasyPostShipmentResponse,
	type EasyPostTracker,
	mapEasyPostStatusToInternal,
} from "../provider";

// ── Realistic EasyPost API fixtures ──────────────────────────────────────────

const MOCK_API_KEY = "EZAKtest_1a2b3c4d5e6f7a8b9c0d1e2f";

const SHIPMENT_WITH_RATES: EasyPostShipmentResponse = {
	id: "shp_a9b97f431c00435cb16ec2d6a14ed109",
	object: "Shipment",
	tracking_code: null,
	rates: [
		{
			id: "rate_9c291b87bdec47a0b3ed151c60b21fb4",
			object: "Rate",
			carrier: "USPS",
			service: "Express",
			rate: "51.20",
			currency: "USD",
			delivery_days: 2,
			delivery_date: null,
			delivery_date_guaranteed: false,
			est_delivery_days: 2,
		},
		{
			id: "rate_e5b3aaafb00f48a4ab27d9f20a801b40",
			object: "Rate",
			carrier: "USPS",
			service: "Priority",
			rate: "11.01",
			currency: "USD",
			delivery_days: 2,
			delivery_date: null,
			delivery_date_guaranteed: false,
			est_delivery_days: 2,
		},
		{
			id: "rate_7f23d4a6bc1e49c8a0d3e5f6b7c8d9e0",
			object: "Rate",
			carrier: "USPS",
			service: "GroundAdvantage",
			rate: "8.20",
			currency: "USD",
			delivery_days: 5,
			delivery_date: null,
			delivery_date_guaranteed: false,
			est_delivery_days: 5,
		},
		{
			id: "rate_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
			object: "Rate",
			carrier: "UPS",
			service: "Ground",
			rate: "15.49",
			currency: "USD",
			delivery_days: 4,
			delivery_date: "2026-03-21",
			delivery_date_guaranteed: true,
			est_delivery_days: 4,
		},
	],
	selected_rate: null,
	postage_label: null,
	tracker: null,
	to_address: {
		id: "adr_to_123",
		name: "Dr. Steve Brule",
		street1: "179 N Harbor Dr",
		city: "Redondo Beach",
		state: "CA",
		zip: "90277",
		country: "US",
		phone: "8573875756",
	},
	from_address: {
		id: "adr_from_456",
		name: "EasyPost",
		street1: "417 Montgomery Street",
		street2: "5th Floor",
		city: "San Francisco",
		state: "CA",
		zip: "94104",
		country: "US",
		phone: "4153334445",
	},
	parcel: {
		id: "prcl_aa5a8eb48a92450c93fe5e452303cee2",
		length: 20.2,
		width: 10.9,
		height: 5,
		weight: 65.9,
	},
	created_at: "2026-03-17T18:00:00Z",
	updated_at: "2026-03-17T18:00:00Z",
};

const PURCHASED_SHIPMENT: EasyPostShipmentResponse = {
	...SHIPMENT_WITH_RATES,
	id: "shp_40b6f049f00348b18de3804a26f7fd62",
	tracking_code: "9434600208303109842228",
	selected_rate: {
		id: "rate_7f23d4a6bc1e49c8a0d3e5f6b7c8d9e0",
		object: "Rate",
		carrier: "USPS",
		service: "GroundAdvantage",
		rate: "8.20",
		currency: "USD",
		delivery_days: 5,
		delivery_date: null,
		delivery_date_guaranteed: false,
		est_delivery_days: 5,
	},
	postage_label: {
		id: "pl_ee9667b7f7cf4ec480f0c4cf3c53f39c",
		label_url:
			"https://easypost-files.s3.us-west-2.amazonaws.com/files/postage_label/20260317/label.png",
		label_pdf_url: null,
		label_zpl_url: null,
		label_size: "4x6",
	},
	tracker: {
		id: "trk_9135862729734d96ad2f9ed0f0565a27",
		tracking_code: "9434600208303109842228",
		status: "pre_transit",
		status_detail: "status_update",
		carrier: "USPS",
		est_delivery_date: "2026-03-22T20:00:00Z",
		public_url: "https://track.easypost.com/djE6dHJrXzkxMzU4NjI3",
		tracking_details: [],
		created_at: "2026-03-17T18:05:00Z",
		updated_at: "2026-03-17T18:05:00Z",
	},
};

const TRACKER_RESPONSE: EasyPostTracker = {
	id: "trk_9135862729734d96ad2f9ed0f0565a27",
	tracking_code: "9434600208303109842228",
	status: "in_transit",
	status_detail: "in_transit",
	carrier: "USPS",
	est_delivery_date: "2026-03-22T20:00:00Z",
	public_url: "https://track.easypost.com/djE6dHJrXzkxMzU4NjI3",
	tracking_details: [
		{
			message: "Shipping Label Created, USPS Awaiting Item",
			status: "pre_transit",
			status_detail: "label_created",
			datetime: "2026-03-17T18:05:00Z",
			source: "USPS",
			tracking_location: {
				city: "SAN FRANCISCO",
				state: "CA",
				country: null,
				zip: "94104",
			},
		},
		{
			message: "Accepted at USPS Origin Facility",
			status: "in_transit",
			status_detail: "in_transit",
			datetime: "2026-03-18T08:30:00Z",
			source: "USPS",
			tracking_location: {
				city: "SAN FRANCISCO",
				state: "CA",
				country: null,
				zip: "94188",
			},
		},
	],
	created_at: "2026-03-17T18:05:00Z",
	updated_at: "2026-03-18T08:30:00Z",
};

const ERROR_RESPONSE = {
	error: {
		code: "ADDRESS.VERIFICATION.FAILURE",
		message: "Unable to verify address",
		errors: [{ field: "address", message: "Address not found" }],
	},
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("EasyPostProvider", () => {
	let provider: EasyPostProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new EasyPostProvider(MOCK_API_KEY, true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe("getRates", () => {
		it("sends POST to /shipments with addresses and parcel", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(SHIPMENT_WITH_RATES),
			});

			const result = await provider.getRates({
				fromAddress: {
					street1: "417 Montgomery Street",
					city: "San Francisco",
					state: "CA",
					zip: "94104",
					country: "US",
				},
				toAddress: {
					street1: "179 N Harbor Dr",
					city: "Redondo Beach",
					state: "CA",
					zip: "90277",
					country: "US",
				},
				parcel: {
					length: 20.2,
					width: 10.9,
					height: 5,
					weight: 65.9,
				},
			});

			expect(result.id).toBe("shp_a9b97f431c00435cb16ec2d6a14ed109");
			expect(result.rates).toHaveLength(4);
			expect(result.rates[0].carrier).toBe("USPS");
			expect(result.rates[0].service).toBe("Express");
			expect(result.rates[0].rate).toBe("51.20");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe("https://api.easypost.com/v2/shipments");
			expect(fetchCall[1]?.method).toBe("POST");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.shipment.from_address.street1).toBe("417 Montgomery Street");
			expect(body.shipment.to_address.verify).toBe(true);
			expect(body.shipment.parcel.weight).toBe(65.9);
		});

		it("includes Basic auth header", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(SHIPMENT_WITH_RATES),
			});

			await provider.getRates({
				fromAddress: {
					street1: "123 Main St",
					city: "SF",
					state: "CA",
					zip: "94104",
					country: "US",
				},
				toAddress: {
					street1: "456 Oak Ave",
					city: "LA",
					state: "CA",
					zip: "90001",
					country: "US",
				},
				parcel: { length: 10, width: 8, height: 4, weight: 16 },
			});

			const headers = vi.mocked(globalThis.fetch).mock.calls[0][1]
				?.headers as Record<string, string>;
			const expectedAuth = `Basic ${btoa(`${MOCK_API_KEY}:`)}`;
			expect(headers.Authorization).toBe(expectedAuth);
			expect(headers["Content-Type"]).toBe("application/json");
		});

		it("throws on API error with code and message", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				json: () => Promise.resolve(ERROR_RESPONSE),
			});

			await expect(
				provider.getRates({
					fromAddress: {
						street1: "invalid",
						city: "X",
						state: "X",
						zip: "00000",
						country: "US",
					},
					toAddress: {
						street1: "invalid",
						city: "Y",
						state: "Y",
						zip: "00000",
						country: "US",
					},
					parcel: { length: 10, width: 8, height: 4, weight: 16 },
				}),
			).rejects.toThrow(
				"EasyPost API error: Unable to verify address (ADDRESS.VERIFICATION.FAILURE)",
			);
		});
	});

	describe("buyShipment", () => {
		it("sends POST to /shipments/{id}/buy with rate", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(PURCHASED_SHIPMENT),
			});

			const result = await provider.buyShipment({
				shipmentId: "shp_a9b97f431c00435cb16ec2d6a14ed109",
				rateId: "rate_7f23d4a6bc1e49c8a0d3e5f6b7c8d9e0",
			});

			expect(result.tracking_code).toBe("9434600208303109842228");
			expect(result.postage_label?.label_url).toContain("label.png");
			expect(result.tracker?.public_url).toContain("track.easypost.com");
			expect(result.selected_rate?.carrier).toBe("USPS");
			expect(result.selected_rate?.service).toBe("GroundAdvantage");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe(
				"https://api.easypost.com/v2/shipments/shp_a9b97f431c00435cb16ec2d6a14ed109/buy",
			);
			expect(fetchCall[1]?.method).toBe("POST");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.rate.id).toBe("rate_7f23d4a6bc1e49c8a0d3e5f6b7c8d9e0");
		});

		it("includes insurance when provided", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(PURCHASED_SHIPMENT),
			});

			await provider.buyShipment({
				shipmentId: "shp_test",
				rateId: "rate_test",
				insurance: "249.99",
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.insurance).toBe("249.99");
		});
	});

	describe("createTracker", () => {
		it("sends POST to /trackers", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TRACKER_RESPONSE),
			});

			const result = await provider.createTracker(
				"9434600208303109842228",
				"USPS",
			);

			expect(result.tracking_code).toBe("9434600208303109842228");
			expect(result.status).toBe("in_transit");
			expect(result.tracking_details).toHaveLength(2);

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.tracker.tracking_code).toBe("9434600208303109842228");
			expect(body.tracker.carrier).toBe("USPS");
		});

		it("works without carrier", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TRACKER_RESPONSE),
			});

			await provider.createTracker("9434600208303109842228");

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.tracker.tracking_code).toBe("9434600208303109842228");
			expect(body.tracker.carrier).toBeUndefined();
		});
	});

	describe("getTracker", () => {
		it("sends GET to /trackers/{id}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TRACKER_RESPONSE),
			});

			const result = await provider.getTracker(
				"trk_9135862729734d96ad2f9ed0f0565a27",
			);

			expect(result.status).toBe("in_transit");
			expect(result.tracking_details[0].message).toBe(
				"Shipping Label Created, USPS Awaiting Item",
			);
			expect(result.tracking_details[1].tracking_location.city).toBe(
				"SAN FRANCISCO",
			);

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe(
				"https://api.easypost.com/v2/trackers/trk_9135862729734d96ad2f9ed0f0565a27",
			);
			expect(vi.mocked(globalThis.fetch).mock.calls[0][1]?.method).toBe("GET");
		});
	});

	describe("getShipment", () => {
		it("sends GET to /shipments/{id}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(PURCHASED_SHIPMENT),
			});

			const result = await provider.getShipment(
				"shp_40b6f049f00348b18de3804a26f7fd62",
			);

			expect(result.tracking_code).toBe("9434600208303109842228");

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe(
				"https://api.easypost.com/v2/shipments/shp_40b6f049f00348b18de3804a26f7fd62",
			);
		});
	});

	describe("verifyConnection", () => {
		it("returns ok with account name when API responds with user", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "user_abc123",
						name: "Test Business",
						email: "test@example.com",
					}),
			});

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "Test Business",
			});

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe("https://api.easypost.com/v2/users");
		});

		it("falls back to email when name is null", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "user_abc123",
						name: null,
						email: "fallback@example.com",
					}),
			});

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "fallback@example.com",
			});
		});

		it("falls back to id when name and email are null", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "user_abc123",
						name: null,
						email: null,
					}),
			});

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "user_abc123",
			});
		});

		it("returns error when API returns 401", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () =>
					Promise.resolve({
						error: {
							code: "UNAUTHORIZED",
							message: "Invalid API key",
						},
					}),
			});

			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			expect(!result.ok).toBeTruthy();
			if (result.ok) {
				throw new Error("expected !result.ok");
			}
			expect(result.error).toContain("Invalid API key");
		});

		it("returns error when fetch throws a network error", async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValue(new Error("Network request failed"));

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});

	describe("verifyAddress", () => {
		it("posts the destination with verify true", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						street1: "500 Customer Ln",
						city: "Madison",
						state: "WI",
						zip: "53703",
						country: "US",
						verifications: { delivery: { success: true } },
					}),
			});

			const result = await provider.verifyAddress({
				street1: "500 Customer Lane",
				city: "Madison",
				state: "WI",
				zip: "53703",
				country: "US",
			});

			expect(result.street1).toBe("500 Customer Ln");
			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string,
			);
			expect(body.verify).toBe(true);
		});

		it("fails closed when delivery verification rejects the address", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						street1: "500 Customer Lane",
						city: "Madison",
						state: "WI",
						zip: "53703",
						country: "US",
						verifications: { delivery: { success: false } },
					}),
			});

			await expect(
				provider.verifyAddress({
					street1: "500 Customer Lane",
					city: "Madison",
					state: "WI",
					zip: "53703",
					country: "US",
				}),
			).rejects.toThrow("could not verify");
		});
	});
});

// ── Status mapping tests ─────────────────────────────────────────────────────

describe("mapEasyPostStatusToInternal", () => {
	it("maps pre_transit to pending", () => {
		expect(mapEasyPostStatusToInternal("pre_transit")).toBe("pending");
	});

	it("maps unknown to pending", () => {
		expect(mapEasyPostStatusToInternal("unknown")).toBe("pending");
	});

	it("maps in_transit to in_transit", () => {
		expect(mapEasyPostStatusToInternal("in_transit")).toBe("in_transit");
	});

	it("maps out_for_delivery to in_transit", () => {
		expect(mapEasyPostStatusToInternal("out_for_delivery")).toBe("in_transit");
	});

	it("maps available_for_pickup to in_transit", () => {
		expect(mapEasyPostStatusToInternal("available_for_pickup")).toBe(
			"in_transit",
		);
	});

	it("maps delivered to delivered", () => {
		expect(mapEasyPostStatusToInternal("delivered")).toBe("delivered");
	});

	it("maps return_to_sender to returned", () => {
		expect(mapEasyPostStatusToInternal("return_to_sender")).toBe("returned");
	});

	it("maps failure to failed", () => {
		expect(mapEasyPostStatusToInternal("failure")).toBe("failed");
	});

	it("maps cancelled to failed", () => {
		expect(mapEasyPostStatusToInternal("cancelled")).toBe("failed");
	});

	it("maps error to failed", () => {
		expect(mapEasyPostStatusToInternal("error")).toBe("failed");
	});
});
