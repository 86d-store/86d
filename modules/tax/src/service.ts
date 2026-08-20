import type { ModuleController } from "@86d-app/core/types/module";

export type TaxRateType = "percentage" | "fixed";
export type TaxExemptionType = "full" | "category";
export type TaxNexusType = "physical" | "economic" | "voluntary";

export type TaxRate = {
	id: string;
	name: string;
	country: string;
	state: string;
	city: string;
	postalCode: string;
	rate: number;
	type: TaxRateType;
	categoryId: string;
	enabled: boolean;
	priority: number;
	compound: boolean;
	inclusive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type TaxCategory = {
	id: string;
	name: string;
	description?: string | undefined;
	createdAt: Date;
};

export type TaxExemption = {
	id: string;
	customerId: string;
	type: TaxExemptionType;
	categoryId?: string | undefined;
	taxIdNumber?: string | undefined;
	reason?: string | undefined;
	expiresAt?: Date | undefined;
	enabled: boolean;
	createdAt: Date;
};

/** Input for a single line item when calculating tax */
export type TaxLineItem = {
	productId: string;
	/** Tax category for this product (defaults to "default") */
	categoryId?: string | undefined;
	/** Line total before tax (price * quantity) */
	amount: number;
	quantity: number;
};

/** Shipping address used to determine tax jurisdiction */
export type TaxAddress = {
	country: string;
	state: string;
	city?: string | undefined;
	postalCode?: string | undefined;
};

/** Result of a tax calculation for a single line item */
export type TaxLineResult = {
	productId: string;
	taxableAmount: number;
	taxAmount: number;
	rate: number;
	rateNames: string[];
	/**
	 * Set when tax was owed at this address but no rate was configured to
	 * calculate it. The amount is zero because nothing could be determined, not
	 * because nothing is due, and a caller must not sell on it.
	 */
	unresolved?: true;
};

/** Result of a full tax calculation */
export type TaxCalculation = {
	/** Total tax amount (sum of all line item taxes + shipping tax) */
	totalTax: number;
	/** Tax on the shipping amount */
	shippingTax: number;
	/**
	 * Set when shipping was taxable at this address but no rate was configured
	 * to calculate it. Carries the same meaning as `unresolved` on a line: the
	 * zero is an absent decision, not a decision that nothing is due.
	 */
	shippingUnresolved?: true;
	/** Per-line-item tax breakdown */
	lines: TaxLineResult[];
	/** Effective combined rate */
	effectiveRate: number;
	/** Whether prices are tax-inclusive */
	inclusive: boolean;
	/** Jurisdiction that matched */
	jurisdiction: {
		country: string;
		state: string;
		city: string;
	};
};

export type CreateTaxRateParams = {
	name: string;
	country: string;
	state?: string | undefined;
	city?: string | undefined;
	postalCode?: string | undefined;
	rate: number;
	type?: TaxRateType | undefined;
	categoryId?: string | undefined;
	enabled?: boolean | undefined;
	priority?: number | undefined;
	compound?: boolean | undefined;
	inclusive?: boolean | undefined;
};

export type UpdateTaxRateParams = {
	name?: string | undefined;
	rate?: number | undefined;
	type?: TaxRateType | undefined;
	enabled?: boolean | undefined;
	priority?: number | undefined;
	compound?: boolean | undefined;
	inclusive?: boolean | undefined;
};

export type CreateTaxCategoryParams = {
	name: string;
	description?: string | undefined;
};

export type CreateTaxExemptionParams = {
	customerId: string;
	type?: TaxExemptionType | undefined;
	categoryId?: string | undefined;
	taxIdNumber?: string | undefined;
	reason?: string | undefined;
	expiresAt?: Date | undefined;
};

export type TaxNexus = {
	id: string;
	country: string;
	state: string;
	type: TaxNexusType;
	enabled: boolean;
	notes?: string | undefined;
	createdAt: Date;
};

export type CreateTaxNexusParams = {
	country: string;
	state?: string | undefined;
	type?: TaxNexusType | undefined;
	notes?: string | undefined;
};

export type TaxTransaction = {
	id: string;
	orderId?: string | undefined;
	customerId?: string | undefined;
	country: string;
	state: string;
	city?: string | undefined;
	postalCode?: string | undefined;
	subtotal: number;
	shippingAmount: number;
	totalTax: number;
	shippingTax: number;
	effectiveRate: number;
	inclusive: boolean;
	exempt: boolean;
	lineDetails: TaxLineResult[];
	rateNames: string[];
	createdAt: Date;
};

export type TaxReportSummary = {
	jurisdiction: { country: string; state: string };
	totalTax: number;
	totalShippingTax: number;
	totalSubtotal: number;
	transactionCount: number;
	effectiveRate: number;
};

export type TaxReportParams = {
	startDate?: Date | undefined;
	endDate?: Date | undefined;
	country?: string | undefined;
	state?: string | undefined;
	limit?: number | undefined;
	offset?: number | undefined;
};

export type TaxController = ModuleController & {
	// --- Tax Rates ---
	createRate(params: CreateTaxRateParams): Promise<TaxRate>;
	getRate(id: string): Promise<TaxRate | null>;
	listRates(params?: {
		country?: string | undefined;
		state?: string | undefined;
		enabled?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<TaxRate[]>;
	updateRate(id: string, params: UpdateTaxRateParams): Promise<TaxRate | null>;
	deleteRate(id: string): Promise<boolean>;

	// --- Tax Categories ---
	createCategory(params: CreateTaxCategoryParams): Promise<TaxCategory>;
	getCategory(id: string): Promise<TaxCategory | null>;
	listCategories(): Promise<TaxCategory[]>;
	deleteCategory(id: string): Promise<boolean>;

	// --- Tax Exemptions ---
	createExemption(params: CreateTaxExemptionParams): Promise<TaxExemption>;
	getExemption(id: string): Promise<TaxExemption | null>;
	listExemptions(customerId: string): Promise<TaxExemption[]>;
	deleteExemption(id: string): Promise<boolean>;

	// --- Tax Calculation ---
	/**
	 * Calculate tax for a set of line items given a shipping address.
	 * This is the main calculation engine that:
	 * 1. Matches applicable tax rates by jurisdiction (country > state > city > postal)
	 * 2. Respects product-level tax categories
	 * 3. Applies customer exemptions
	 * 4. Handles compound rates and priority ordering
	 * 5. Optionally taxes shipping
	 */
	calculate(params: {
		address: TaxAddress;
		lineItems: TaxLineItem[];
		shippingAmount?: number | undefined;
		customerId?: string | undefined;
	}): Promise<TaxCalculation>;

	/**
	 * Look up applicable rates for a jurisdiction without performing a calculation.
	 * Useful for displaying "estimated tax" before full address is entered.
	 */
	getRatesForAddress(address: TaxAddress): Promise<TaxRate[]>;

	// --- Tax Nexus ---
	createNexus(params: CreateTaxNexusParams): Promise<TaxNexus>;
	getNexus(id: string): Promise<TaxNexus | null>;
	listNexus(params?: {
		country?: string | undefined;
		enabled?: boolean | undefined;
	}): Promise<TaxNexus[]>;
	deleteNexus(id: string): Promise<boolean>;

	/**
	 * Check whether the store has nexus in a given jurisdiction.
	 * Returns true if any enabled nexus covers the country + state.
	 * When no nexus records exist at all, returns true (nexus enforcement off).
	 */
	hasNexus(address: TaxAddress): Promise<boolean>;

	// --- Tax Transactions (audit log) ---
	/**
	 * Record a tax calculation for audit purposes.
	 * Called automatically by calculate() to build the audit trail.
	 */
	logTransaction(params: {
		orderId?: string | undefined;
		customerId?: string | undefined;
		address: TaxAddress;
		calculation: TaxCalculation;
		subtotal: number;
		shippingAmount: number;
	}): Promise<TaxTransaction>;

	listTransactions(params?: TaxReportParams): Promise<TaxTransaction[]>;

	/**
	 * Link a transaction to an order after checkout completes.
	 */
	linkTransactionToOrder(
		transactionId: string,
		orderId: string,
	): Promise<TaxTransaction | null>;

	// --- Tax Reporting ---
	/**
	 * Aggregate tax collected by jurisdiction for compliance reporting.
	 * Groups transactions by country + state and sums totals.
	 */
	getReport(params?: TaxReportParams): Promise<TaxReportSummary[]>;
};
