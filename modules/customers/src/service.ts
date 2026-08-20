import type { ModuleController } from "@86d-app/core/types/module";

export type Customer = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone?: string | undefined;
	dateOfBirth?: Date | undefined;
	tags?: string[] | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CustomerAddress = {
	id: string;
	customerId: string;
	type: "billing" | "shipping";
	firstName: string;
	lastName: string;
	company?: string | undefined;
	line1: string;
	line2?: string | undefined;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | undefined;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type CustomerController = ModuleController & {
	/**
	 * Get a customer by ID
	 */
	getById(id: string): Promise<Customer | null>;

	/**
	 * Get a customer by email
	 */
	getByEmail(email: string): Promise<Customer | null>;

	/**
	 * Create a new customer
	 */
	create(params: {
		id?: string;
		email: string;
		firstName: string;
		lastName: string;
		phone?: string;
		dateOfBirth?: Date;
		tags?: string[];
		metadata?: Record<string, unknown>;
	}): Promise<Customer>;

	/**
	 * Update a customer
	 */
	update(
		id: string,
		params: {
			firstName?: string | undefined;
			lastName?: string | undefined;
			phone?: string | null | undefined;
			dateOfBirth?: Date | null | undefined;
			tags?: string[] | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Customer | null>;

	/**
	 * Delete a customer
	 */
	delete(id: string): Promise<void>;

	/**
	 * List customers with pagination
	 */
	list(params: {
		limit?: number | undefined;
		offset?: number | undefined;
		search?: string | undefined;
		tag?: string | undefined;
	}): Promise<{ customers: Customer[]; total: number }>;

	/**
	 * Add tags to a customer (deduplicates)
	 */
	addTags(customerId: string, tags: string[]): Promise<Customer | null>;

	/**
	 * Remove tags from a customer
	 */
	removeTags(customerId: string, tags: string[]): Promise<Customer | null>;

	/**
	 * List all unique tags across all customers
	 */
	listAllTags(): Promise<{ tag: string; count: number }[]>;

	/**
	 * Bulk add tags to multiple customers
	 */
	bulkAddTags(
		customerIds: string[],
		tags: string[],
	): Promise<{ updated: number }>;

	/**
	 * Bulk remove tags from multiple customers
	 */
	bulkRemoveTags(
		customerIds: string[],
		tags: string[],
	): Promise<{ updated: number }>;

	/**
	 * Get all addresses for a customer
	 */
	listAddresses(customerId: string): Promise<CustomerAddress[]>;

	/**
	 * Get a specific address
	 */
	getAddress(id: string): Promise<CustomerAddress | null>;

	/**
	 * Create an address for a customer
	 */
	createAddress(params: {
		customerId: string;
		type?: "billing" | "shipping" | undefined;
		firstName: string;
		lastName: string;
		company?: string | undefined;
		line1: string;
		line2?: string | undefined;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		phone?: string | undefined;
		isDefault?: boolean | undefined;
	}): Promise<CustomerAddress>;

	/**
	 * Update an address
	 */
	updateAddress(
		id: string,
		params: {
			type?: "billing" | "shipping" | undefined;
			firstName?: string | undefined;
			lastName?: string | undefined;
			company?: string | null | undefined;
			line1?: string | undefined;
			line2?: string | null | undefined;
			city?: string | undefined;
			state?: string | undefined;
			postalCode?: string | undefined;
			country?: string | undefined;
			phone?: string | null | undefined;
			isDefault?: boolean | undefined;
		},
	): Promise<CustomerAddress | null>;

	/**
	 * Delete an address
	 */
	deleteAddress(id: string): Promise<void>;

	/**
	 * Set an address as default (and unset any previous default of same type)
	 */
	setDefaultAddress(
		customerId: string,
		addressId: string,
	): Promise<CustomerAddress | null>;

	/**
	 * List all customers for export (no pagination limit)
	 */
	listForExport(params: {
		search?: string | undefined;
		tag?: string | undefined;
		dateFrom?: string | undefined;
		dateTo?: string | undefined;
	}): Promise<Customer[]>;

	/**
	 * Import customers from parsed CSV rows. Matches by email (update) or creates new.
	 */
	importCustomers(rows: ImportCustomerRow[]): Promise<ImportCustomerResult>;

	// --- Loyalty Points ---

	/**
	 * Get a customer's loyalty points balance
	 */
	getLoyaltyBalance(customerId: string): Promise<LoyaltyBalance>;

	/**
	 * Get a customer's loyalty transaction history
	 */
	getLoyaltyHistory(
		customerId: string,
		params?: {
			limit?: number | undefined;
			offset?: number | undefined;
		},
	): Promise<{ transactions: LoyaltyTransaction[]; total: number }>;

	/**
	 * Earn loyalty points (positive points added)
	 */
	earnPoints(params: {
		customerId: string;
		points: number;
		reason: string;
		orderId?: string | undefined;
	}): Promise<LoyaltyTransaction>;

	/**
	 * Redeem loyalty points (points deducted)
	 */
	redeemPoints(params: {
		customerId: string;
		points: number;
		reason: string;
		orderId?: string | undefined;
	}): Promise<LoyaltyTransaction>;

	/**
	 * Manually adjust loyalty points (admin use)
	 */
	adjustPoints(params: {
		customerId: string;
		points: number;
		reason: string;
	}): Promise<LoyaltyTransaction>;

	/**
	 * Get overall loyalty program stats
	 */
	getLoyaltyStats(): Promise<LoyaltyStats>;
};

export type ImportCustomerRow = {
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
	phone?: string | undefined;
	tags?: string[] | undefined;
};

export type ImportCustomerResult = {
	created: number;
	updated: number;
	errors: { row: number; field: string; message: string }[];
};

// --- Loyalty Points ---

export type LoyaltyTransactionType = "earn" | "redeem" | "adjust";

export type LoyaltyTransaction = {
	id: string;
	customerId: string;
	type: LoyaltyTransactionType;
	points: number;
	balance: number;
	reason: string;
	orderId?: string | undefined;
	createdAt: Date;
};

export type LoyaltyBalance = {
	customerId: string;
	totalEarned: number;
	totalRedeemed: number;
	balance: number;
	transactionCount: number;
};

export type LoyaltyStats = {
	totalCustomersWithPoints: number;
	totalPointsIssued: number;
	totalPointsRedeemed: number;
	totalPointsOutstanding: number;
	averageBalance: number;
	topCustomers: {
		customerId: string;
		email: string;
		name: string;
		balance: number;
	}[];
};

export type LoyaltyRules = {
	pointsPerDollar: number;
	redemptionRate: number;
	minimumRedemption: number;
	enabled: boolean;
};

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
	pointsPerDollar: 1,
	redemptionRate: 0.01,
	minimumRedemption: 100,
	enabled: false,
};
