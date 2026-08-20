/**
 * TaxJar API provider.
 * Makes real HTTP calls to https://api.taxjar.com/v2/ or sandbox.
 * Authentication uses Bearer token.
 */

// ── TaxJar API types ────────────────────────────────────────────────────────

export interface TaxJarAddress {
	country: string;
	zip: string;
	state: string;
	city?: string | undefined;
	street?: string | undefined;
}

export interface TaxJarLineItem {
	id: string;
	quantity: number;
	product_tax_code?: string | undefined;
	unit_price: number;
	discount?: number | undefined;
}

export interface TaxJarNexusAddress {
	id?: string | undefined;
	country: string;
	zip: string;
	state: string;
	city?: string | undefined;
	street?: string | undefined;
}

export interface TaxJarCalculateParams {
	fromAddress: TaxJarAddress;
	toAddress: TaxJarAddress;
	shipping: number;
	lineItems: TaxJarLineItem[];
	nexusAddresses?: TaxJarNexusAddress[] | undefined;
	customerExemptionType?: string | undefined;
}

export interface TaxJarLineBreakdown {
	id: string;
	taxable_amount: number;
	tax_collectable: number;
	combined_tax_rate: number;
	state_taxable_amount: number;
	state_sales_tax_rate: number;
	state_amount: number;
	county_taxable_amount: number;
	county_tax_rate: number;
	county_amount: number;
	city_taxable_amount: number;
	city_tax_rate: number;
	city_amount: number;
	special_district_taxable_amount: number;
	special_tax_rate: number;
	special_district_amount: number;
}

export interface TaxJarBreakdown {
	taxable_amount: number;
	tax_collectable: number;
	combined_tax_rate: number;
	state_taxable_amount: number;
	state_tax_rate: number;
	state_tax_collectable: number;
	county_taxable_amount: number;
	county_tax_rate: number;
	county_tax_collectable: number;
	city_taxable_amount: number;
	city_tax_rate: number;
	city_tax_collectable: number;
	special_district_taxable_amount: number;
	special_tax_rate: number;
	special_district_tax_collectable: number;
	line_items: TaxJarLineBreakdown[];
}

export interface TaxJarJurisdictions {
	country: string;
	state: string;
	county: string;
	city: string;
}

export interface TaxJarTaxResponse {
	tax: {
		order_total_amount: number;
		shipping: number;
		taxable_amount: number;
		amount_to_collect: number;
		rate: number;
		has_nexus: boolean;
		freight_taxable: boolean;
		tax_source: string;
		jurisdictions: TaxJarJurisdictions;
		breakdown: TaxJarBreakdown;
	};
}

export interface TaxJarRateResponse {
	rate: {
		zip: string;
		state: string;
		state_rate: string;
		county: string;
		county_rate: string;
		city: string;
		city_rate: string;
		combined_district_rate: string;
		combined_rate: string;
		freight_taxable: boolean;
	};
}

export interface TaxJarErrorResponse {
	status: number;
	error: string;
	detail: string;
}

// ── Provider class ──────────────────────────────────────────────────────────

export class TaxJarProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	constructor(apiKey: string, sandbox = false) {
		this.apiKey = apiKey;
		this.baseUrl = sandbox
			? "https://api.sandbox.taxjar.com/v2"
			: "https://api.taxjar.com/v2";
	}

	private async request<T>(
		method: "GET" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		const json = (await res.json()) as T | TaxJarErrorResponse;
		if (!res.ok) {
			const err = json as TaxJarErrorResponse;
			throw new Error(
				`TaxJar API error: ${err.detail ?? err.error ?? `HTTP ${res.status}`}`,
			);
		}
		return json as T;
	}

	/**
	 * Calculate tax for an order.
	 * Makes a real POST /v2/taxes call to TaxJar.
	 */
	async calculateTax(
		params: TaxJarCalculateParams,
	): Promise<TaxJarTaxResponse> {
		const amount = params.lineItems.reduce(
			(sum, item) =>
				sum + item.unit_price * item.quantity - (item.discount ?? 0),
			0,
		);

		return this.request<TaxJarTaxResponse>("POST", "/taxes", {
			from_country: params.fromAddress.country,
			from_zip: params.fromAddress.zip,
			from_state: params.fromAddress.state,
			...(params.fromAddress.city
				? { from_city: params.fromAddress.city }
				: {}),
			...(params.fromAddress.street
				? { from_street: params.fromAddress.street }
				: {}),
			to_country: params.toAddress.country,
			to_zip: params.toAddress.zip,
			to_state: params.toAddress.state,
			...(params.toAddress.city ? { to_city: params.toAddress.city } : {}),
			...(params.toAddress.street
				? { to_street: params.toAddress.street }
				: {}),
			amount,
			shipping: params.shipping,
			...(params.nexusAddresses
				? { nexus_addresses: params.nexusAddresses }
				: {}),
			...(params.customerExemptionType
				? { exemption_type: params.customerExemptionType }
				: {}),
			line_items: params.lineItems.map((item) => ({
				id: item.id,
				quantity: item.quantity,
				unit_price: item.unit_price,
				...(item.product_tax_code
					? { product_tax_code: item.product_tax_code }
					: {}),
				...(item.discount !== undefined ? { discount: item.discount } : {}),
			})),
		});
	}

	/**
	 * Look up the tax rate for a US zip code.
	 * Makes a real GET /v2/rates/:zip call to TaxJar.
	 */
	async getRateForZip(
		zip: string,
		params?: {
			city?: string | undefined;
			state?: string | undefined;
			country?: string | undefined;
			street?: string | undefined;
		},
	): Promise<TaxJarRateResponse> {
		const query = new URLSearchParams();
		if (params?.city) query.set("city", params.city);
		if (params?.state) query.set("state", params.state);
		if (params?.country) query.set("country", params.country);
		if (params?.street) query.set("street", params.street);

		const queryStr = query.toString();
		const path = `/rates/${encodeURIComponent(zip)}${queryStr ? `?${queryStr}` : ""}`;
		return this.request<TaxJarRateResponse>("GET", path);
	}

	/**
	 * Verify API credentials by fetching the categories list.
	 * TaxJar has no /account endpoint, so we use /categories as a lightweight auth check.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			const result = await this.request<{
				categories: Array<{
					product_tax_code: string;
					name: string;
					description: string;
				}>;
			}>("GET", "/categories");
			return {
				ok: true,
				accountName: `TaxJar (${result.categories.length} tax categories)`,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}
