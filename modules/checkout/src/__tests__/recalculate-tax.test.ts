import type {
	CapabilityDecision,
	CapabilityInvoker,
	CapabilityRequest,
} from "@86d-app/core/capabilities";
import type { taxQuoteV2Capability } from "@86d-app/core/commerce-capabilities";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type {
	CheckoutAddress,
	CheckoutLineItem,
	CheckoutSession,
} from "../service";
import { createCheckoutController } from "../service-impl";
import {
	CHECKOUT_ADDRESS_NORMALIZATION_VERSION,
	recalculateTax,
} from "../store/endpoints/recalculate-tax";

// ---------------------------------------------------------------------------
// Mock tax.quote v2 invoker
// ---------------------------------------------------------------------------

type TaxQuoteV2Request = CapabilityRequest<typeof taxQuoteV2Capability>;
type TaxQuoteV2Decision = CapabilityDecision<typeof taxQuoteV2Capability>;

type TaxQuoteV2Invoker = {
	invoke(
		definition: typeof taxQuoteV2Capability,
		request: TaxQuoteV2Request,
	): Promise<
		| { ok: true; decision: TaxQuoteV2Decision }
		| {
				ok: false;
				failure: {
					code: "CAPABILITY_UNAVAILABLE";
					capability: string;
					version: string;
				};
		  }
	>;
};

function createMockTaxCapabilities(
	options: {
		taxRate?: number;
		status?: TaxQuoteV2Decision["status"];
		reason?: TaxQuoteV2Decision["reason"];
		tax?: number | null;
	} = {},
) {
	const taxRate = options.taxRate ?? 0.1;
	const status = options.status ?? "CALCULATED";
	const reason =
		options.reason ??
		(status === "CALCULATED"
			? "TAX_CALCULATED"
			: status === "NO_NEXUS"
				? "NO_NEXUS_POLICY"
				: status === "EXEMPT"
					? "EXEMPTION_APPLIED"
					: status === "MARKETPLACE_COLLECTED"
						? "MARKETPLACE_POLICY"
						: "RATE_NOT_CONFIGURED");
	const calls: TaxQuoteV2Request[] = [];

	const capabilities: TaxQuoteV2Invoker & {
		_calls: TaxQuoteV2Request[];
	} = {
		_calls: calls,
		async invoke(_definition, request) {
			calls.push(request);
			const subtotal = request.lineItems.reduce(
				(sum, item) => sum + item.unitAmount * item.quantity,
				0,
			);
			const discount = request.lineItems.reduce(
				(sum, item) => sum + (item.discountAmount ?? 0),
				0,
			);
			const taxable = subtotal - discount;
			const tax =
				options.tax !== undefined
					? options.tax
					: status === "REVIEW_REQUIRED"
						? null
						: Math.round(taxable * taxRate);
			const shipping = request.shippingAmount ?? 0;

			return {
				ok: true as const,
				decision: {
					quoteId: `quote-${calls.length}`,
					jurisdictionDecision:
						status === "REVIEW_REQUIRED"
							? "BLOCKED"
							: status === "NO_NEXUS"
								? "NO_NEXUS"
								: status === "MARKETPLACE_COLLECTED"
									? "MARKETPLACE_COLLECTED"
									: "COLLECT",
					status,
					reason,
					policyVersion: "policy-v1",
					sourceVersion: "rates-v1",
					issuedAt: "2026-08-14T00:00:00.000Z",
					expiresAt: "2026-08-14T00:10:00.000Z",
					currency: request.currency,
					totals: {
						subtotal,
						discount,
						shipping,
						taxable,
						lineTax: tax,
						shippingTax: status === "REVIEW_REQUIRED" ? null : 0,
						tax,
						grandTotal: tax === null ? null : taxable + shipping + tax,
					},
					lineAllocations: request.lineItems.map((item) => {
						const grossAmount = item.unitAmount * item.quantity;
						const discountAmount = item.discountAmount ?? 0;
						const lineTaxable = grossAmount - discountAmount;
						return {
							lineId: item.lineId,
							productId: item.productId,
							...(item.variantId ? { variantId: item.variantId } : {}),
							taxCategoryId: item.taxCategoryId,
							quantity: item.quantity,
							grossAmount,
							discountAmount,
							taxableAmount: lineTaxable,
							taxAmount:
								tax === null ? null : Math.round(lineTaxable * taxRate),
						};
					}),
				} satisfies TaxQuoteV2Decision,
			};
		},
	};

	return capabilities as CapabilityInvoker & {
		_calls: TaxQuoteV2Request[];
	};
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{
		productId: "p2",
		variantId: "v1",
		name: "Gadget S",
		sku: "GAD-S",
		price: 2000,
		quantity: 1,
	},
];

const sampleAddress: CheckoutAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

async function createSessionWithDiscount(
	ctrl: ReturnType<typeof createCheckoutController>,
	overrides: Partial<{
		discountAmount: number;
		discountCode: string;
		shippingAddress: CheckoutAddress;
		shippingAmount: number;
		taxAmount: number;
	}> = {},
) {
	const session = await ctrl.create({
		subtotal: 4000,
		total: 4000,
		lineItems: sampleLineItems,
		shippingAddress: overrides.shippingAddress ?? sampleAddress,
		shippingAmount: overrides.shippingAmount ?? 0,
		taxAmount: overrides.taxAmount ?? 0,
		discountAmount: overrides.discountAmount ?? 0,
		...(overrides.discountCode
			? { metadata: { discountCode: overrides.discountCode } }
			: {}),
	});

	let current = session;
	if (overrides.discountAmount && overrides.discountAmount > 0) {
		const discounted = await ctrl.applyDiscount(session.id, {
			code: overrides.discountCode ?? "SAVE",
			discountAmount: overrides.discountAmount,
			freeShipping: false,
		});
		current = discounted as CheckoutSession;
	}
	return current as CheckoutSession;
}

// ---------------------------------------------------------------------------
// recalculateTax — tax.quote v2
// ---------------------------------------------------------------------------

describe("recalculateTax", () => {
	it("returns CHECKOUT_TAX_UNAVAILABLE when the tax capability fails", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl);
		const unavailable = {
			invoke: async () => ({
				ok: false as const,
				failure: {
					code: "CAPABILITY_UNAVAILABLE" as const,
					capability: "tax.quote",
					version: "2.0.0",
				},
			}),
		} satisfies CapabilityInvoker;

		const result = await recalculateTax(session, ctrl, unavailable);
		expect(result).toEqual({
			ok: false,
			code: "CHECKOUT_TAX_UNAVAILABLE",
		});
	});

	it("returns original session when no shipping address", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create({
			subtotal: 4000,
			total: 4000,
			lineItems: sampleLineItems,
		});
		const taxCtrl = createMockTaxCapabilities();

		const result = await recalculateTax(session, ctrl, taxCtrl);
		expect(result).toEqual({ ok: true, session });
		expect(taxCtrl._calls).toHaveLength(0);
	});

	it("persists CALCULATED tax and binds the quote identity", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl);
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.taxAmount).toBe(400);
		expect(result.session.metadata).toMatchObject({
			taxQuoteId: "quote-1",
			taxQuoteStatus: "CALCULATED",
		});
		expect(taxCtrl._calls[0]).toMatchObject({
			currency: "USD",
			marketplaceStatus: "NOT_MARKETPLACE",
			address: {
				country: "US",
				state: "IL",
				city: "Springfield",
				postalCode: "62701",
				normalizationVersion: CHECKOUT_ADDRESS_NORMALIZATION_VERSION,
			},
			lineItems: [
				{
					lineId: "p1::0",
					productId: "p1",
					taxCategoryId: "general",
					quantity: 2,
					unitAmount: 1000,
				},
				{
					lineId: "p2:v1:1",
					productId: "p2",
					variantId: "v1",
					taxCategoryId: "general",
					quantity: 1,
					unitAmount: 2000,
				},
			],
		});
	});

	it("distributes discount as line discountAmount for tax.quote v2", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl, {
			discountAmount: 1000,
		});
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.taxAmount).toBe(300);
		expect(taxCtrl._calls[0].lineItems).toEqual([
			{
				lineId: "p1::0",
				productId: "p1",
				taxCategoryId: "general",
				quantity: 2,
				unitAmount: 1000,
				discountAmount: 500,
			},
			{
				lineId: "p2:v1:1",
				productId: "p2",
				variantId: "v1",
				taxCategoryId: "general",
				quantity: 1,
				unitAmount: 2000,
				discountAmount: 500,
			},
		]);
	});

	it("persists reasoned zero for NO_NEXUS without REVIEW_REQUIRED", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl, { taxAmount: 50 });
		const taxCtrl = createMockTaxCapabilities({
			status: "NO_NEXUS",
			tax: 0,
		});

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.taxAmount).toBe(0);
		expect(result.session.metadata).toMatchObject({
			taxQuoteStatus: "NO_NEXUS",
			taxQuoteReason: "NO_NEXUS_POLICY",
		});
	});

	it("persists reasoned zero for EXEMPT", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl, { taxAmount: 50 });
		const taxCtrl = createMockTaxCapabilities({
			status: "EXEMPT",
			tax: 0,
		});

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.taxAmount).toBe(0);
		expect(result.session.metadata).toMatchObject({
			taxQuoteStatus: "EXEMPT",
		});
	});

	it("fails closed on REVIEW_REQUIRED without writing inferred zero", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl, { taxAmount: 50 });
		const taxCtrl = createMockTaxCapabilities({
			status: "REVIEW_REQUIRED",
			reason: "RATE_NOT_CONFIGURED",
			tax: null,
		});

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result).toEqual({
			ok: false,
			code: "TAX_REVIEW_REQUIRED",
			reason: "RATE_NOT_CONFIGURED",
		});
		const unchanged = await ctrl.getById(session.id);
		expect(unchanged?.taxAmount).toBe(50);
	});

	it("updates total correctly after CALCULATED tax", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await createSessionWithDiscount(ctrl, {
			discountAmount: 1000,
			shippingAmount: 500,
		});
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const result = await recalculateTax(session, ctrl, taxCtrl);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.taxAmount).toBe(300);
		expect(result.session.total).toBe(3800);
	});

	it("passes shipping amount and customerId to tax.quote v2", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create({
			subtotal: 4000,
			total: 4000,
			lineItems: sampleLineItems,
			shippingAddress: sampleAddress,
			shippingAmount: 800,
			customerId: "cust-789",
		});
		const taxCtrl = createMockTaxCapabilities();

		await recalculateTax(session, ctrl, taxCtrl);

		expect(taxCtrl._calls[0].shippingAmount).toBe(800);
		expect(taxCtrl._calls[0].customerId).toBe("cust-789");
	});
});

describe("apply/remove discount tax recalculation flow", () => {
	it("tax decreases when discount is applied", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const session = await createSessionWithDiscount(ctrl);
		const withTax = await recalculateTax(session, ctrl, taxCtrl);
		expect(withTax.ok && withTax.session.taxAmount).toBe(400);

		const discounted = await ctrl.applyDiscount(
			withTax.ok ? withTax.session.id : "",
			{
				code: "SAVE25",
				discountAmount: 1000,
				freeShipping: false,
			},
		);

		const afterDiscount = await recalculateTax(
			discounted as CheckoutSession,
			ctrl,
			taxCtrl,
		);

		expect(afterDiscount.ok && afterDiscount.session.taxAmount).toBe(300);
	});

	it("tax restores when discount is removed", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const session = await createSessionWithDiscount(ctrl, {
			discountAmount: 1000,
		});
		const withDiscountTax = await recalculateTax(session, ctrl, taxCtrl);
		expect(withDiscountTax.ok && withDiscountTax.session.taxAmount).toBe(300);

		const noDiscount = await ctrl.removeDiscount(
			withDiscountTax.ok ? withDiscountTax.session.id : "",
		);

		const afterRemove = await recalculateTax(
			noDiscount as CheckoutSession,
			ctrl,
			taxCtrl,
		);

		expect(afterRemove.ok && afterRemove.session.taxAmount).toBe(400);
	});

	it("total is correct through full apply-tax-remove-tax cycle", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const session = await createSessionWithDiscount(ctrl, {
			shippingAmount: 500,
		});

		const step1 = await recalculateTax(session, ctrl, taxCtrl);
		expect(step1.ok && step1.session.total).toBe(4900);

		const discounted = await ctrl.applyDiscount(
			step1.ok ? step1.session.id : "",
			{
				code: "SAVE5",
				discountAmount: 500,
				freeShipping: false,
			},
		);

		const step2 = await recalculateTax(
			discounted as CheckoutSession,
			ctrl,
			taxCtrl,
		);
		expect(step2.ok && step2.session.taxAmount).toBe(350);
		expect(step2.ok && step2.session.total).toBe(4350);

		const removed = await ctrl.removeDiscount(step2.ok ? step2.session.id : "");
		const step3 = await recalculateTax(
			removed as CheckoutSession,
			ctrl,
			taxCtrl,
		);
		expect(step3.ok && step3.session.taxAmount).toBe(400);
		expect(step3.ok && step3.session.total).toBe(4900);
	});

	it("free shipping discount recalculates tax with zero shipping", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const taxCtrl = createMockTaxCapabilities({ taxRate: 0.1 });

		const session = await createSessionWithDiscount(ctrl, {
			shippingAmount: 500,
		});
		const withTax = await recalculateTax(session, ctrl, taxCtrl);

		const discounted = await ctrl.applyDiscount(
			withTax.ok ? withTax.session.id : "",
			{
				code: "FREESHIP",
				discountAmount: 0,
				freeShipping: true,
			},
		);

		const afterDiscount = await recalculateTax(
			discounted as CheckoutSession,
			ctrl,
			taxCtrl,
		);

		expect(afterDiscount.ok && afterDiscount.session.shippingAmount).toBe(0);
		expect(afterDiscount.ok && afterDiscount.session.taxAmount).toBe(400);
		const lastCall = taxCtrl._calls[taxCtrl._calls.length - 1];
		expect(lastCall.shippingAmount).toBe(0);
	});
});
