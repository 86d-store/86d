import type { ModuleController } from "@86d-app/core/types/module";

export type InventoryItem = {
	id: string;
	productId: string;
	variantId?: string | undefined;
	locationId?: string | undefined;
	/** Product name snapshot — set at write time to avoid cross-module lookups */
	productName?: string | undefined;
	/** Variant name snapshot (e.g. "Blue / L") */
	variantName?: string | undefined;
	/** Total units on hand */
	quantity: number;
	/** Units reserved for pending orders */
	reserved: number;
	/** Available = quantity - reserved */
	available: number;
	lowStockThreshold?: number | undefined;
	allowBackorder: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type BackInStockSubscription = {
	id: string;
	productId: string;
	variantId?: string | undefined;
	email: string;
	customerId?: string | undefined;
	productName?: string | undefined;
	status: "active" | "notified";
	subscribedAt: Date;
	notifiedAt?: Date | undefined;
};

export type BackInStockStats = {
	totalActive: number;
	totalNotified: number;
	uniqueProducts: number;
};

export type InventoryController = ModuleController & {
	/**
	 * Get inventory item for a product/variant/location.
	 * Returns null if no tracking record exists.
	 */
	getStock(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
	}): Promise<InventoryItem | null>;

	/**
	 * Set absolute stock level for a product (upsert).
	 * Creates the record if it does not exist.
	 */
	setStock(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		quantity: number;
		lowStockThreshold?: number | undefined;
		allowBackorder?: boolean | undefined;
		productName?: string | undefined;
		variantName?: string | undefined;
	}): Promise<InventoryItem>;

	/**
	 * Adjust stock by a signed delta (positive = restock, negative = shrinkage).
	 * Returns null if the item does not exist.
	 */
	adjustStock(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		delta: number;
	}): Promise<InventoryItem | null>;

	/**
	 * Reserve units for a pending order.
	 * Returns null if insufficient available stock (and backorder is disabled).
	 */
	reserve(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		quantity: number;
	}): Promise<InventoryItem | null>;

	/**
	 * Release a previous reservation (e.g., order cancelled).
	 * Returns null if the item does not exist.
	 */
	release(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		quantity: number;
	}): Promise<InventoryItem | null>;

	/**
	 * Fulfill a reservation: decrement both quantity and reserved.
	 * Called when an order is shipped/delivered.
	 * Returns null if the item does not exist.
	 */
	deduct(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		quantity: number;
	}): Promise<InventoryItem | null>;

	/** Check if sufficient available stock exists */
	isInStock(params: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
		quantity?: number | undefined;
	}): Promise<boolean>;

	/** List items below their low-stock threshold */
	getLowStockItems(params?: {
		locationId?: string | undefined;
	}): Promise<InventoryItem[]>;

	/** List all inventory items, optionally filtered */
	listItems(params?: {
		productId?: string | undefined;
		locationId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<InventoryItem[]>;

	// ── Back-in-stock subscriptions ──────────────────────────────────

	/** Subscribe an email to be notified when a product is back in stock */
	subscribeBackInStock(params: {
		productId: string;
		variantId?: string | undefined;
		email: string;
		customerId?: string | undefined;
		productName?: string | undefined;
	}): Promise<BackInStockSubscription>;

	/** Remove a back-in-stock subscription */
	unsubscribeBackInStock(params: {
		productId: string;
		variantId?: string | undefined;
		email: string;
	}): Promise<boolean>;

	/** Check if an email is subscribed for back-in-stock notifications */
	checkBackInStockSubscription(params: {
		productId: string;
		variantId?: string | undefined;
		email: string;
	}): Promise<boolean>;

	/** Get active subscribers for a product (used by notification handler) */
	getBackInStockSubscribers(params: {
		productId: string;
		variantId?: string | undefined;
	}): Promise<BackInStockSubscription[]>;

	/** List all subscriptions (admin) */
	listBackInStockSubscriptions(params?: {
		productId?: string | undefined;
		status?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<BackInStockSubscription[]>;

	/** Get subscription stats (admin) */
	getBackInStockStats(): Promise<BackInStockStats>;

	/** Mark subscribers as notified (called by notification handler) */
	markSubscribersNotified(params: {
		productId: string;
		variantId?: string | undefined;
	}): Promise<number>;
};
