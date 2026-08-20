import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
	type CreateShippingQuoteInput,
	createShippingFoundationController,
	createShippingQuoteInputSchema,
	isUspsPriorityMailRate,
	type ShippingAddress,
	type ShippingConnectionProvider,
	type ShippingParcel,
	USPS_PRIORITY_MAIL_SERVICE,
} from "../foundation-v2";

const origin = {
	name: "86d Merchant",
	street1: "100 Warehouse Way",
	city: "Austin",
	state: "TX",
	postalCode: "78701",
	country: "US",
} satisfies ShippingAddress;

const destination = {
	name: "Avery Shopper",
	street1: "500 Customer Lane",
	city: "Madison",
	state: "WI",
	postalCode: "53703",
	country: "US",
} satisfies ShippingAddress;

const parcelPlan = [
	{
		parcelReference: "parcel-one",
		lengthInches: 10,
		widthInches: 8,
		heightInches: 4,
		weightOunces: 24,
	},
	{
		parcelReference: "parcel-two",
		lengthInches: 6,
		widthInches: 4,
		heightInches: 3,
		weightOunces: 12,
	},
] satisfies ShippingParcel[];

function provider() {
	const verify = vi.fn(async () => ({
		ok: true as const,
		accountName: "EasyPost test account",
	}));
	const quote = vi.fn(async () => ({
		providerQuoteReference: "easypost-shipment-1",
		verifiedDestinationAddress: destination,
		options: [
			{
				providerRateReference: "easypost-rate-usps-priority",
				carrier: "USPS",
				service: "Priority",
				amountMinor: 895,
				currency: "USD",
				deliveryDays: 2,
				deliveryDate: null,
				deliveryDateGuaranteed: false,
			},
		],
	}));
	return {
		connectionId: "shipping-connection-1",
		provider: "easypost",
		mode: "test",
		capabilities: [
			"quote",
			"label",
			"tracking",
			"label_refund",
			"postage_adjustment",
		],
		verify,
		quote,
	} satisfies ShippingConnectionProvider;
}

async function enabledController(activeProvider = provider()) {
	const transactions = createMockTransactionRunner();
	const controller = createShippingFoundationController(
		transactions.data,
		transactions,
		[activeProvider],
	);
	await controller.ensureConnection({
		id: activeProvider.connectionId,
		name: "Primary EasyPost",
		provider: "easypost",
		mode: "test",
		capabilities: [...activeProvider.capabilities],
		secretReference: "secret://shipping/easypost/primary",
		originAddress: origin,
	});
	await controller.checkConnection(activeProvider.connectionId);
	await controller.enableConnection(activeProvider.connectionId);
	return { transactions, controller, activeProvider };
}

function quoteInput() {
	return {
		checkoutId: "checkout-1",
		checkoutRevision: 2,
		connectionId: "shipping-connection-1",
		idempotencyKey: "shipping-quote-operation-1",
		destinationAddress: destination,
		parcelPlan: [...parcelPlan],
		currency: "USD",
	} satisfies CreateShippingQuoteInput;
}

describe("Shipping v2 authority", () => {
	it("uses the Connection origin and replays a local quote identity after restart", async () => {
		const { transactions, controller, activeProvider } =
			await enabledController();
		const first = await controller.createQuote(quoteInput());
		const restarted = createShippingFoundationController(
			transactions.data,
			transactions,
			[activeProvider],
		);
		const replay = await restarted.createQuote(quoteInput());

		expect(replay).toEqual(first);
		expect(activeProvider.quote).toHaveBeenCalledTimes(1);
		expect(activeProvider.quote).toHaveBeenCalledWith(
			expect.objectContaining({
				originAddress: origin,
				destinationAddress: destination,
				parcelPlan,
			}),
		);
		expect(transactions.data.all("shippingQuoteV2")).toHaveLength(1);
		expect(transactions.data.all("shippingOptionV2")).toHaveLength(1);
		expect(
			createShippingQuoteInputSchema.safeParse({
				...quoteInput(),
				originAddress: {
					...origin,
					street1: "shopper-controlled origin",
				},
			}).success,
		).toBe(false);
	});

	it("retries a failed provider quote without duplicating its local result", async () => {
		const activeProvider = provider();
		activeProvider.quote.mockRejectedValueOnce(new Error("ambiguous timeout"));
		const { transactions, controller } =
			await enabledController(activeProvider);

		await expect(controller.createQuote(quoteInput())).rejects.toThrow(
			"ambiguous timeout",
		);
		const recovered = await controller.createQuote(quoteInput());
		const replay = await controller.createQuote(quoteInput());

		expect(replay).toEqual(recovered);
		expect(activeProvider.quote).toHaveBeenCalledTimes(2);
		expect(transactions.data.all("shippingQuoteV2")).toHaveLength(1);
		expect(transactions.data.all("shippingOptionV2")).toHaveLength(1);
		expect(transactions.data.all("shippingQuoteRequestV2")).toEqual([
			expect.objectContaining({ state: "succeeded", attempt: 2 }),
		]);
	});

	it("keeps multiple parcels, tracking, refund, and adjustment on the original Connection", async () => {
		const { transactions, controller } = await enabledController();
		const { quote, options } = await controller.createQuote(quoteInput());
		const option = options[0];
		if (!option) throw new Error("quote did not return an option");
		const firstLabel = await controller.recordPurchasedLabel({
			fulfillmentId: "fulfillment-split",
			checkoutId: "checkout-1",
			checkoutRevision: 2,
			quoteId: quote.id,
			optionId: option.id,
			parcelReference: "parcel-one",
			idempotencyKey: "label-operation-parcel-one",
			providerLabelReference: "easypost-label-1",
			providerTrackingReference: "easypost-tracker-1",
			trackingCode: "TRACK-ONE",
		});
		const replayedLabel = await controller.recordPurchasedLabel({
			fulfillmentId: "fulfillment-split",
			checkoutId: "checkout-1",
			checkoutRevision: 2,
			quoteId: quote.id,
			optionId: option.id,
			parcelReference: "parcel-one",
			idempotencyKey: "label-operation-parcel-one",
			providerLabelReference: "easypost-label-1",
			providerTrackingReference: "easypost-tracker-1",
			trackingCode: "TRACK-ONE",
		});
		const secondLabel = await controller.recordPurchasedLabel({
			fulfillmentId: "fulfillment-split",
			checkoutId: "checkout-1",
			checkoutRevision: 2,
			quoteId: quote.id,
			optionId: option.id,
			parcelReference: "parcel-two",
			idempotencyKey: "label-operation-parcel-two",
			providerLabelReference: "easypost-label-2",
			providerTrackingReference: "easypost-tracker-2",
			trackingCode: "TRACK-TWO",
		});

		expect(replayedLabel).toEqual(firstLabel);
		expect(firstLabel.status).toBe("pre_transit");
		expect(secondLabel.status).toBe("pre_transit");
		expect(transactions.data.all("shippingLabelV2")).toHaveLength(2);

		const newest = await controller.recordTracking({
			fulfillmentId: "fulfillment-split",
			labelId: firstLabel.id,
			providerTrackerReference: "easypost-tracker-1",
			trackingCode: "TRACK-ONE",
			status: "delivered",
			providerOccurredAt: new Date("2026-08-13T14:00:00.000Z"),
		});
		const stale = await controller.recordTracking({
			fulfillmentId: "fulfillment-split",
			labelId: firstLabel.id,
			providerTrackerReference: "easypost-tracker-1",
			trackingCode: "TRACK-ONE",
			status: "in_transit",
			providerOccurredAt: new Date("2026-08-13T13:00:00.000Z"),
		});
		expect(stale).toEqual(newest);
		expect(stale.status).toBe("delivered");

		await controller.revokeConnection("shipping-connection-1");
		const refund = await controller.recordLabelRefund({
			fulfillmentId: "fulfillment-split",
			labelId: firstLabel.id,
			idempotencyKey: "label-refund-operation-1",
			status: "needs_attention",
		});
		const adjustment = await controller.recordPostageAdjustment({
			fulfillmentId: "fulfillment-split",
			labelId: firstLabel.id,
			idempotencyKey: "postage-adjustment-operation-1",
			providerAdjustmentReference: "easypost-adjustment-1",
			kind: "debit",
			amountMinor: 125,
			currency: "USD",
			recordedAt: new Date("2026-08-13T15:00:00.000Z"),
		});

		expect(refund).toMatchObject({
			connectionId: "shipping-connection-1",
			status: "needs_attention",
		});
		expect(adjustment).toMatchObject({
			connectionId: "shipping-connection-1",
			amountMinor: 125,
		});
		await expect(
			controller.recordTracking({
				fulfillmentId: "another-fulfillment",
				labelId: firstLabel.id,
				providerTrackerReference: "easypost-tracker-1",
				trackingCode: "TRACK-ONE",
				status: "delivered",
				providerOccurredAt: new Date("2026-08-13T16:00:00.000Z"),
			}),
		).rejects.toMatchObject({ code: "original_connection_mismatch" });
	});

	it("persists the verified destination fingerprint instead of raw shopper input", async () => {
		const activeProvider = provider();
		const verified = {
			...destination,
			street1: "500 Customer Ln",
			postalCode: "53703",
		};
		activeProvider.quote.mockResolvedValue({
			providerQuoteReference: "easypost-shipment-verified",
			verifiedDestinationAddress: verified,
			options: [
				{
					providerRateReference: "easypost-rate-usps-priority",
					carrier: "USPS",
					service: USPS_PRIORITY_MAIL_SERVICE,
					amountMinor: 895,
					currency: "USD",
					deliveryDays: 2,
					deliveryDate: null,
					deliveryDateGuaranteed: false,
				},
			],
		});
		const { controller } = await enabledController(activeProvider);
		const { quote, options } = await controller.createQuote(quoteInput());

		expect(quote.destinationAddress).toEqual(verified);
		expect(quote.addressFingerprint).not.toBe(
			await crypto.subtle
				.digest(
					"SHA-256",
					new TextEncoder().encode(JSON.stringify(destination)),
				)
				.then((digest) =>
					[...new Uint8Array(digest)]
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join(""),
				),
		);
		expect(options[0]?.service).toBe(USPS_PRIORITY_MAIL_SERVICE);
	});

	it("recognizes EasyPost USPS Priority names and rejects adjacent services", () => {
		expect(
			isUspsPriorityMailRate({ carrier: "USPS", service: "Priority" }),
		).toBe(true);
		expect(
			isUspsPriorityMailRate({ carrier: "usps", service: "PriorityMail" }),
		).toBe(true);
		expect(
			isUspsPriorityMailRate({
				carrier: "USPS",
				service: "Priority Mail International",
			}),
		).toBe(false);
		expect(
			isUspsPriorityMailRate({ carrier: "UPS", service: "Priority" }),
		).toBe(false);
	});

	it("updates origin on an existing connection and requires re-enablement", async () => {
		const { controller } = await enabledController();
		const updatedOrigin = {
			...origin,
			street1: "200 Warehouse Blvd",
			city: "Dallas",
			state: "TX",
			postalCode: "75201",
		};

		const updated = await controller.updateConnectionOrigin(
			"shipping-connection-1",
			updatedOrigin,
		);
		expect(updated.originAddress).toEqual(updatedOrigin);
		expect(updated.health).toBe("unknown");
		expect(updated.lifecycle).toBe("draft");

		await controller.checkConnection("shipping-connection-1");
		const enabled = await controller.enableConnection("shipping-connection-1");
		expect(enabled.lifecycle).toBe("enabled");
		expect(enabled.health).toBe("healthy");
	});

	it("rejects origin updates on revoked connections", async () => {
		const { controller } = await enabledController();
		await controller.revokeConnection("shipping-connection-1");

		await expect(
			controller.updateConnectionOrigin("shipping-connection-1", {
				...origin,
				street1: "999 Blocked Way",
			}),
		).rejects.toMatchObject({ code: "connection_revoked" });
	});
});
