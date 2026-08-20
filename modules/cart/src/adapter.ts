import type { BaseAdapter } from "@86d-app/core/adapters";

/**
 * Cart data types
 */
export interface Cart {
	id: string;
	customerId?: string | undefined;
	guestId?: string | undefined;
	status: "active" | "abandoned" | "converted";
	expiresAt: Date;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

export interface CartItem {
	id: string;
	cartId: string;
	productId: string;
	variantId?: string | undefined;
	quantity: number;
	price: number;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

export interface CartWithDetails extends Cart {
	items: CartItem[];
	itemCount: number;
	subtotal: number;
}

/**
 * Cart adapter parameters
 */
export interface GetOrCreateCartParams {
	customerId?: string | undefined;
	guestId?: string | undefined;
}

export interface UpdateCartData {
	status?: Cart["status"] | undefined;
	expiresAt?: Date | undefined;
	metadata?: Record<string, unknown> | undefined;
}

export interface AddCartItemParams {
	cartId: string;
	productId: string;
	variantId?: string | undefined;
	quantity: number;
	price: number;
	metadata?: Record<string, unknown> | undefined;
}

export interface UpdateCartItemData {
	quantity?: number | undefined;
	price?: number | undefined;
	metadata?: Record<string, unknown> | undefined;
}

export interface ListCartsParams {
	page?: number | undefined;
	limit?: number | undefined;
	customerId?: string | undefined;
	status?: Cart["status"] | undefined;
	startDate?: Date | undefined;
	endDate?: Date | undefined;
}

export interface PaginatedCarts {
	carts: CartWithDetails[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Cart adapter interface
 */
export interface CartAdapter extends BaseAdapter {
	cart: {
		getOrCreate(params: GetOrCreateCartParams): Promise<Cart>;
		getById(id: string): Promise<Cart | null>;
		update(id: string, data: UpdateCartData): Promise<Cart>;
		delete(id: string): Promise<void>;
		addItem(params: AddCartItemParams): Promise<CartItem>;
		removeItem(itemId: string): Promise<void>;
		updateItem(itemId: string, data: UpdateCartItemData): Promise<CartItem>;
		clearItems(cartId: string): Promise<void>;
		getItems(cartId: string): Promise<CartItem[]>;
		// Admin operations
		list(params: ListCartsParams): Promise<PaginatedCarts>;
		getDetails(id: string): Promise<CartWithDetails>;
	};
}

/**
 * Default in-memory implementation for development
 */
export function createInMemoryCartAdapter(): CartAdapter {
	const carts = new Map<string, Cart>();
	const items = new Map<string, CartItem>();
	let cartIdCounter = 1;
	let itemIdCounter = 1;

	return {
		cart: {
			async getOrCreate(params: GetOrCreateCartParams): Promise<Cart> {
				// Try to find existing cart
				if (params.customerId) {
					for (const cart of Array.from(carts.values())) {
						if (
							cart.customerId === params.customerId &&
							cart.status === "active"
						) {
							return cart;
						}
					}
				}
				if (params.guestId) {
					for (const cart of Array.from(carts.values())) {
						if (cart.guestId === params.guestId && cart.status === "active") {
							return cart;
						}
					}
				}

				// Create new cart
				const now = new Date();
				const cart: Cart = {
					id: `cart_${cartIdCounter++}`,
					customerId: params.customerId ?? undefined,
					guestId: params.guestId ?? undefined,
					status: "active",
					expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
					metadata: {},
					createdAt: now,
					updatedAt: now,
				};
				carts.set(cart.id, cart);
				return cart;
			},

			async getById(id: string): Promise<Cart | null> {
				return carts.get(id) || null;
			},

			async update(id: string, data: UpdateCartData): Promise<Cart> {
				const cart = carts.get(id);
				if (!cart) {
					throw new Error(`Cart ${id} not found`);
				}

				const updatedCart: Cart = {
					...cart,
					...(data.status !== undefined && { status: data.status }),
					...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
					...(data.metadata !== undefined && { metadata: data.metadata }),
					updatedAt: new Date(),
				};
				carts.set(id, updatedCart);
				return updatedCart;
			},

			async delete(id: string): Promise<void> {
				// Delete cart and all its items
				for (const [itemId, item] of Array.from(items.entries())) {
					if (item.cartId === id) {
						items.delete(itemId);
					}
				}
				carts.delete(id);
			},

			async addItem(params: AddCartItemParams): Promise<CartItem> {
				const now = new Date();
				const item: CartItem = {
					id: `item_${itemIdCounter++}`,
					cartId: params.cartId,
					productId: params.productId,
					variantId: params.variantId ?? undefined,
					quantity: params.quantity,
					price: params.price,
					metadata: params.metadata || {},
					createdAt: now,
					updatedAt: now,
				};
				items.set(item.id, item);

				// Update cart timestamp
				const cart = carts.get(params.cartId);
				if (cart) {
					cart.updatedAt = now;
				}

				return item;
			},

			async removeItem(itemId: string): Promise<void> {
				const item = items.get(itemId);
				if (item) {
					items.delete(itemId);
					// Update cart timestamp
					const cart = carts.get(item.cartId);
					if (cart) {
						cart.updatedAt = new Date();
					}
				}
			},

			async updateItem(
				itemId: string,
				data: UpdateCartItemData,
			): Promise<CartItem> {
				const item = items.get(itemId);
				if (!item) {
					throw new Error(`Cart item ${itemId} not found`);
				}

				const updatedItem: CartItem = {
					...item,
					...(data.quantity !== undefined && { quantity: data.quantity }),
					...(data.price !== undefined && { price: data.price }),
					...(data.metadata !== undefined && { metadata: data.metadata }),
					updatedAt: new Date(),
				};
				items.set(itemId, updatedItem);

				// Update cart timestamp
				const cart = carts.get(item.cartId);
				if (cart) {
					cart.updatedAt = new Date();
				}

				return updatedItem;
			},

			async clearItems(cartId: string): Promise<void> {
				for (const [itemId, item] of Array.from(items.entries())) {
					if (item.cartId === cartId) {
						items.delete(itemId);
					}
				}

				// Update cart timestamp
				const cart = carts.get(cartId);
				if (cart) {
					cart.updatedAt = new Date();
				}
			},

			async getItems(cartId: string): Promise<CartItem[]> {
				const cartItems: CartItem[] = [];
				for (const item of Array.from(items.values())) {
					if (item.cartId === cartId) {
						cartItems.push(item);
					}
				}
				return cartItems;
			},

			// Admin operations
			async list(params: ListCartsParams): Promise<PaginatedCarts> {
				const page = params.page || 1;
				const limit = params.limit || 20;
				const offset = (page - 1) * limit;

				// Filter carts
				let filteredCarts = Array.from(carts.values());

				if (params.customerId) {
					filteredCarts = filteredCarts.filter(
						(c) => c.customerId === params.customerId,
					);
				}
				if (params.status) {
					filteredCarts = filteredCarts.filter(
						(c) => c.status === params.status,
					);
				}
				if (params.startDate) {
					const startDate = params.startDate;
					filteredCarts = filteredCarts.filter((c) => c.createdAt >= startDate);
				}
				if (params.endDate) {
					const endDate = params.endDate;
					filteredCarts = filteredCarts.filter((c) => c.createdAt <= endDate);
				}

				const total = filteredCarts.length;
				const paginatedCarts = filteredCarts.slice(offset, offset + limit);

				// Add items to each cart
				const cartsWithDetails: CartWithDetails[] = await Promise.all(
					paginatedCarts.map(async (cart) => {
						const cartItems = await this.getItems(cart.id);
						return {
							...cart,
							items: cartItems,
							itemCount: cartItems.length,
							subtotal: cartItems.reduce(
								(sum: number, item: CartItem) =>
									sum + item.price * item.quantity,
								0,
							),
						};
					}),
				);

				return {
					carts: cartsWithDetails,
					total,
					page,
					limit,
					hasMore: offset + limit < total,
				};
			},

			async getDetails(id: string): Promise<CartWithDetails> {
				const cart = carts.get(id);
				if (!cart) {
					throw new Error(`Cart ${id} not found`);
				}

				const cartItems = await this.getItems(id);

				return {
					...cart,
					items: cartItems,
					itemCount: cartItems.length,
					subtotal: cartItems.reduce(
						(sum: number, item: CartItem) => sum + item.price * item.quantity,
						0,
					),
				};
			},
		},
	};
}

/**
 * Default cart adapter instance
 */
export const defaultCartAdapter = createInMemoryCartAdapter();
