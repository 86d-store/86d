import type { CapabilityRequest } from "@86d-app/core/capabilities";
import type { taxQuoteV2Capability } from "@86d-app/core/commerce-capabilities";
import { z } from "zod";
import { TaxJarProvider } from "./provider";

type TaxQuoteV2Request = CapabilityRequest<typeof taxQuoteV2Capability>;

const taxJarV2ResponseSchema = z
	.object({
		tax: z
			.object({
				amount_to_collect: z.number().finite().nonnegative(),
				has_nexus: z.boolean(),
				tax_source: z.string().min(1).max(200),
				jurisdictions: z
					.object({
						country: z.string(),
						state: z.string(),
						county: z.string(),
						city: z.string(),
					})
					.passthrough(),
				breakdown: z
					.object({
						line_items: z.array(
							z
								.object({
									id: z.string().min(1).max(200),
									taxable_amount: z.number().finite().nonnegative(),
									tax_collectable: z.number().finite().nonnegative(),
								})
								.passthrough(),
						),
					})
					.passthrough(),
			})
			.passthrough(),
	})
	.passthrough();

export type TaxProviderV2Result =
	| {
			ok: true;
			hasNexus: boolean;
			totalTax: number;
			shippingTax: number;
			lineAllocations: Array<{
				lineId: string;
				taxableAmount: number;
				taxAmount: number;
			}>;
			sourceReference: string;
	  }
	| {
			ok: false;
			reason:
				| "PROVIDER_FAILED"
				| "PROVIDER_RESPONSE_INVALID"
				| "UNSUPPORTED_CURRENCY";
	  };

export interface TaxQuoteProviderV2 {
	readonly kind: "TAXJAR";
	readonly connectionId: string;
	readonly name: string;
	quote(request: TaxQuoteV2Request): Promise<TaxProviderV2Result>;
}

export type TaxJarQuoteProviderV2Options = {
	apiKey: string;
	sandbox: boolean;
	connectionId: string;
	origin: {
		country: string;
		state: string;
		postalCode: string;
		city?: string | undefined;
		street?: string | undefined;
	};
};

export function minorUnitsToTaxJarMajorUnits(amount: number): number {
	return amount / 100;
}

export function taxJarMajorUnitsToMinorUnits(amount: number): number | null {
	if (!Number.isFinite(amount) || amount < 0) return null;
	const scaled = amount * 100;
	const rounded = Math.round(scaled);
	if (
		!Number.isSafeInteger(rounded) ||
		Math.abs(scaled - rounded) > 0.000_001
	) {
		return null;
	}
	return rounded;
}

export class TaxJarQuoteProviderV2 implements TaxQuoteProviderV2 {
	readonly kind = "TAXJAR";
	readonly connectionId: string;
	readonly name = "TaxJar";
	private readonly provider: TaxJarProvider;
	private readonly origin: TaxJarQuoteProviderV2Options["origin"];

	constructor(options: TaxJarQuoteProviderV2Options) {
		this.connectionId = options.connectionId;
		this.origin = options.origin;
		this.provider = new TaxJarProvider(options.apiKey, options.sandbox);
	}

	async quote(request: TaxQuoteV2Request): Promise<TaxProviderV2Result> {
		if (request.currency !== "USD") {
			return { ok: false, reason: "UNSUPPORTED_CURRENCY" };
		}

		try {
			const response = await this.provider.calculateTax({
				fromAddress: {
					country: this.origin.country,
					state: this.origin.state,
					zip: this.origin.postalCode,
					city: this.origin.city,
					street: this.origin.street,
				},
				toAddress: {
					country: request.address.country,
					state: request.address.state,
					zip: request.address.postalCode ?? "",
					city: request.address.city,
				},
				shipping: minorUnitsToTaxJarMajorUnits(request.shippingAmount ?? 0),
				lineItems: request.lineItems.map((line) => ({
					id: line.lineId,
					quantity: line.quantity,
					unit_price: minorUnitsToTaxJarMajorUnits(line.unitAmount),
					discount: minorUnitsToTaxJarMajorUnits(line.discountAmount ?? 0),
					product_tax_code: line.taxCategoryId,
				})),
				nexusAddresses: [
					{
						id: this.connectionId,
						country: this.origin.country,
						state: this.origin.state,
						zip: this.origin.postalCode,
						city: this.origin.city,
						street: this.origin.street,
					},
				],
			});
			const parsed = taxJarV2ResponseSchema.safeParse(response);
			if (!parsed.success) {
				return { ok: false, reason: "PROVIDER_RESPONSE_INVALID" };
			}

			const providerLines = new Map(
				parsed.data.tax.breakdown.line_items.map((line) => [line.id, line]),
			);
			if (
				providerLines.size !== request.lineItems.length ||
				request.lineItems.some((line) => !providerLines.has(line.lineId))
			) {
				return { ok: false, reason: "PROVIDER_RESPONSE_INVALID" };
			}

			const lineAllocations = request.lineItems.map((line) => {
				const providerLine = providerLines.get(line.lineId);
				return {
					lineId: line.lineId,
					taxableAmount:
						providerLine === undefined
							? null
							: taxJarMajorUnitsToMinorUnits(providerLine.taxable_amount),
					taxAmount:
						providerLine === undefined
							? null
							: taxJarMajorUnitsToMinorUnits(providerLine.tax_collectable),
				};
			});
			if (
				lineAllocations.some(
					(line) => line.taxableAmount === null || line.taxAmount === null,
				)
			) {
				return { ok: false, reason: "PROVIDER_RESPONSE_INVALID" };
			}
			const completeLineAllocations = lineAllocations.flatMap((line) => {
				if (line.taxableAmount === null || line.taxAmount === null) return [];
				return [
					{
						lineId: line.lineId,
						taxableAmount: line.taxableAmount,
						taxAmount: line.taxAmount,
					},
				];
			});

			const totalTax = taxJarMajorUnitsToMinorUnits(
				parsed.data.tax.amount_to_collect,
			);
			if (totalTax === null) {
				return { ok: false, reason: "PROVIDER_RESPONSE_INVALID" };
			}
			const lineTax = completeLineAllocations.reduce(
				(total, line) => total + line.taxAmount,
				0,
			);
			const shippingTax = totalTax - lineTax;
			if (!Number.isSafeInteger(lineTax) || shippingTax < 0) {
				return { ok: false, reason: "PROVIDER_RESPONSE_INVALID" };
			}

			return {
				ok: true,
				hasNexus: parsed.data.tax.has_nexus,
				totalTax,
				shippingTax,
				lineAllocations: completeLineAllocations,
				sourceReference: parsed.data.tax.tax_source,
			};
		} catch {
			return { ok: false, reason: "PROVIDER_FAILED" };
		}
	}
}
