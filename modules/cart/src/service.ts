import type { ModuleController } from "@86d-app/core/types/module";

export type Cart = {
	id: string;
	customerId?: string | undefined;
	guestId?: string | undefined;
	status: "active" | "abandoned" | "converted";
	expiresAt: Date;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CartItem = {
	id: string;
	cartId: string;
	productId: string;
	variantId?: string | undefined;
	quantity: number;
	price: number;
	/** Snapshot of product name at time of add */
	productName: string;
	/** Snapshot of product slug for linking */
	productSlug: string;
	/** First product image URL */
	productImage?: string | undefined;
	/** Variant display name (e.g., "Blue / Medium") */
	variantName?: string | undefined;
	/** Variant options map (e.g., { "Color": "Blue", "Size": "M" }) */
	variantOptions?: Record<string, string> | undefined;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Public API that other modules can use
 */
export type CartController = ModuleController & {
	/** Resolve a Cart by its owner-local identity. */
	getById(id: string): Promise<Cart | null>;

	/**
	 * Get or create a cart for a customer/guest
	 */
	getOrCreateCart(params: {
		customerId?: string;
		guestId?: string;
	}): Promise<Cart>;

	/**
	 * Get cart items
	 */
	getCartItems(cartId: string): Promise<CartItem[]>;

	/**
	 * Calculate cart total
	 */
	getCartTotal(cartId: string): Promise<number>;

	/**
	 * Check if product is in any active cart
	 */
	isProductInActiveCart(productId: string): Promise<boolean>;

	/**
	 * Add item to cart
	 */
	addItem(params: {
		cartId: string;
		productId: string;
		variantId?: string | undefined;
		quantity: number;
		price: number;
		productName: string;
		productSlug: string;
		productImage?: string | undefined;
		variantName?: string | undefined;
		variantOptions?: Record<string, string> | undefined;
	}): Promise<CartItem>;

	/**
	 * Update cart item quantity
	 */
	updateItem(itemId: string, quantity: number): Promise<CartItem>;

	/**
	 * Remove item from cart
	 */
	removeItem(itemId: string): Promise<void>;

	/**
	 * Clear all items from cart
	 */
	clearCart(cartId: string): Promise<void>;

	/**
	 * Find active carts that haven't been updated beyond the threshold.
	 * These are candidates for abandoned cart recovery.
	 */
	getAbandonedCarts(opts?: {
		thresholdHours?: number | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Cart[]>;

	/**
	 * Mark a cart as abandoned.
	 */
	markAsAbandoned(cartId: string): Promise<Cart>;

	/**
	 * Record that a recovery email was sent for this cart.
	 * Tracks timestamp and count in the cart's metadata.
	 */
	markRecoveryEmailSent(cartId: string): Promise<Cart>;

	/**
	 * Get recovery statistics: total abandoned, recovery emails sent, converted.
	 */
	getRecoveryStats(): Promise<{
		totalAbandoned: number;
		recoverySent: number;
		recovered: number;
	}>;

	/**
	 * Merge items from a guest cart into a customer cart.
	 * Guest items are added to the customer cart (quantities stack for duplicates).
	 * The guest cart is cleared after a successful merge.
	 * Returns the number of items merged.
	 */
	mergeGuestCart(params: {
		guestId: string;
		customerId: string;
	}): Promise<{ merged: number; customerCartId: string }>;
};
