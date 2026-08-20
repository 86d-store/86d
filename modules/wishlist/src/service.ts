import type { ModuleController } from "@86d-app/core/types/module";

export type WishlistItem = {
	id: string;
	customerId: string;
	customerEmail?: string | undefined;
	productId: string;
	productName: string;
	productImage?: string | undefined;
	note?: string | undefined;
	addedAt: Date;
};

export type WishlistShare = {
	id: string;
	customerId: string;
	token: string;
	active: boolean;
	createdAt: Date;
	expiresAt?: Date | undefined;
};

export type WishlistSummary = {
	totalItems: number;
	topProducts: Array<{ productId: string; productName: string; count: number }>;
};

export type WishlistController = ModuleController & {
	addItem(params: {
		customerId: string;
		customerEmail?: string | undefined;
		productId: string;
		productName: string;
		productImage?: string | undefined;
		note?: string | undefined;
	}): Promise<WishlistItem>;

	removeItem(id: string): Promise<boolean>;

	removeByProduct(customerId: string, productId: string): Promise<boolean>;

	/** Remove multiple items by ID for a customer. Returns count of removed items. */
	bulkRemove(customerId: string, itemIds: string[]): Promise<number>;

	getItem(id: string): Promise<WishlistItem | null>;

	isInWishlist(customerId: string, productId: string): Promise<boolean>;

	listByCustomer(
		customerId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<WishlistItem[]>;

	listAll(params?: {
		customerId?: string | undefined;
		productId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<{ items: WishlistItem[]; total: number }>;

	countByCustomer(customerId: string): Promise<number>;

	getSummary(): Promise<WishlistSummary>;

	/** Create a shareable link token for a customer's wishlist. */
	createShareToken(
		customerId: string,
		expiresAt?: Date | undefined,
	): Promise<WishlistShare>;

	/** Revoke a share token. */
	revokeShareToken(customerId: string, tokenId: string): Promise<boolean>;

	/** Get active share tokens for a customer. */
	getShareTokens(customerId: string): Promise<WishlistShare[]>;

	/** Get items for a shared wishlist by token. Returns null if token is invalid/expired. */
	getSharedWishlist(token: string): Promise<WishlistItem[] | null>;
};
