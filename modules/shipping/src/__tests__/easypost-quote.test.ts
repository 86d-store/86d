import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createEasyPostShippingConnectionProvider,
	USPS_PRIORITY_MAIL_SERVICE,
} from "../foundation-v2";
import type { EasyPostShipmentResponse } from "../provider";

const origin = {
	street1: "100 Warehouse Way",
	city: "Austin",
	state: "TX",
	postalCode: "78701",
	country: "US",
};

const destination = {
	name: "Avery Shopper",
	street1: "500 Customer Lane",
	city: "Madison",
	state: "WI",
	postalCode: "53703",
	country: "US",
};

const parcelPlan = [
	{
		parcelReference: "checkout-default-parcel",
		lengthInches: 10,
		widthInches: 8,
		heightInches: 4,
		weightOunces: 16,
	},
];

const shipment = {
	id: "shp_quote_1",
	object: "Shipment",
	tracking_code: null,
	rates: [
		{
			id: "rate_express",
			object: "Rate",
			carrier: "USPS",
			service: "Express",
			rate: "51.20",
			currency: "USD",
			delivery_days: 1,
			delivery_date: null,
			delivery_date_guaranteed: false,
			est_delivery_days: 1,
		},
		{
			id: "rate_priority",
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
			id: "rate_ups",
			object: "Rate",
			carrier: "UPS",
			service: "Ground",
			rate: "15.49",
			currency: "USD",
			delivery_days: 4,
			delivery_date: null,
			delivery_date_guaranteed: false,
			est_delivery_days: 4,
		},
	],
	selected_rate: null,
	postage_label: null,
	tracker: null,
	to_address: {
		id: "adr_to",
		name: "Avery Shopper",
		street1: "500 Customer Ln",
		city: "Madison",
		state: "WI",
		zip: "53703",
		country: "US",
	},
	from_address: {
		id: "adr_from",
		street1: origin.street1,
		city: origin.city,
		state: origin.state,
		zip: origin.postalCode,
		country: origin.country,
	},
	parcel: {
		id: "prcl_1",
		length: 10,
		width: 8,
		height: 4,
		weight: 16,
	},
	created_at: "2026-08-14T12:00:00Z",
	updated_at: "2026-08-14T12:00:00Z",
} satisfies EasyPostShipmentResponse;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("EasyPost quote adapter", () => {
	it("verifies the destination and returns only canonical USPS Priority Mail", async () => {
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.endsWith("/addresses")) {
					return new Response(
						JSON.stringify({
							street1: "500 Customer Ln",
							city: "Madison",
							state: "WI",
							zip: "53703",
							country: "US",
							name: "Avery Shopper",
							verifications: { delivery: { success: true } },
						}),
						{ status: 200 },
					);
				}
				return new Response(JSON.stringify(shipment), { status: 200 });
			});
		const adapter = createEasyPostShippingConnectionProvider({
			connectionId: "shipping_easypost_default",
			apiKey: "EZTK_test",
			testMode: true,
		});

		const quoted = await adapter.quote({
			originAddress: origin,
			destinationAddress: destination,
			parcelPlan,
			currency: "USD",
		});

		expect(quoted.options).toEqual([
			expect.objectContaining({
				providerRateReference: "rate_priority",
				carrier: "USPS",
				service: USPS_PRIORITY_MAIL_SERVICE,
				amountMinor: 1101,
			}),
		]);
		expect(quoted.verifiedDestinationAddress).toMatchObject({
			street1: "500 Customer Ln",
			postalCode: "53703",
		});
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(String(fetch.mock.calls[0]?.[0])).toContain("/addresses");
	});

	it("fails closed when EasyPost returns no USPS Priority Mail rate", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith("/addresses")) {
				return new Response(
					JSON.stringify({
						street1: destination.street1,
						city: destination.city,
						state: destination.state,
						zip: destination.postalCode,
						country: destination.country,
						verifications: { delivery: { success: true } },
					}),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify({
					...shipment,
					rates: shipment.rates.filter((rate) => rate.service !== "Priority"),
				}),
				{ status: 200 },
			);
		});
		const adapter = createEasyPostShippingConnectionProvider({
			connectionId: "shipping_easypost_default",
			apiKey: "EZTK_test",
			testMode: true,
		});

		await expect(
			adapter.quote({
				originAddress: origin,
				destinationAddress: destination,
				parcelPlan,
				currency: "USD",
			}),
		).rejects.toThrow("USPS Priority Mail");
	});
});
