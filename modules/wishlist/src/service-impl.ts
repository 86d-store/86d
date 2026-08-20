import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	WishlistController,
	WishlistItem,
	WishlistShare,
} from "./service";

export interface WishlistControllerOptions {
	maxItems?: number | undefined;
}

export function createWishlistController(
	data: ModuleDataService,
	options?: WishlistControllerOptions | undefined,
): WishlistController {
	const maxItems = options?.maxItems;

	return {
		async addItem(params) {
			// Check for duplicate — same customer + product
			const existing = await data.findMany("wishlistItem", {
				where: { customerId: params.customerId, productId: params.productId },
				take: 1,
			});
			const existingItems = existing as unknown as WishlistItem[];
			if (existingItems.length > 0) {
				return existingItems[0];
			}

			// Enforce maxItems limit
			if (maxItems !== undefined && maxItems > 0) {
				const currentCount = await this.countByCustomer(params.customerId);
				if (currentCount >= maxItems) {
					throw new Error(`Wishlist limit reached (max ${maxItems} items)`);
				}
			}

			const id = crypto.randomUUID();
			const item: WishlistItem = {
				id,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				productId: params.productId,
				productName: params.productName,
				productImage: params.productImage,
				note: params.note,
				addedAt: new Date(),
			};
			await data.upsert("wishlistItem", id, item as Record<string, unknown>);
			return item;
		},

		async removeItem(id) {
			const existing = await data.get("wishlistItem", id);
			if (!existing) return false;
			await data.delete("wishlistItem", id);
			return true;
		},

		async removeByProduct(customerId, productId) {
			const items = await data.findMany("wishlistItem", {
				where: { customerId, productId },
			});
			const found = items as unknown as WishlistItem[];
			if (found.length === 0) return false;
			for (const item of found) {
				await data.delete("wishlistItem", item.id);
			}
			return true;
		},

		async bulkRemove(customerId, itemIds) {
			let removed = 0;
			for (const id of itemIds) {
				const item = await data.get("wishlistItem", id);
				if (!item) continue;
				const wishlistItem = item as unknown as WishlistItem;
				if (wishlistItem.customerId !== customerId) continue;
				await data.delete("wishlistItem", id);
				removed++;
			}
			return removed;
		},

		async getItem(id) {
			const raw = await data.get("wishlistItem", id);
			if (!raw) return null;
			return raw as unknown as WishlistItem;
		},

		async isInWishlist(customerId, productId) {
			const items = await data.findMany("wishlistItem", {
				where: { customerId, productId },
				take: 1,
			});
			return (items as unknown as WishlistItem[]).length > 0;
		},

		async listByCustomer(customerId, params) {
			const all = await data.findMany("wishlistItem", {
				where: { customerId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as WishlistItem[];
		},

		async listAll(params) {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.productId) where.productId = params.productId;

			const whereOption = Object.keys(where).length > 0 ? { where } : {};

			// Get total count (unfiltered by pagination)
			const allMatching = await data.findMany("wishlistItem", whereOption);
			const total = allMatching.length;

			// Get paginated results
			const page = await data.findMany("wishlistItem", {
				...whereOption,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});

			return {
				items: page as unknown as WishlistItem[],
				total,
			};
		},

		async countByCustomer(customerId) {
			const all = await data.findMany("wishlistItem", {
				where: { customerId },
			});
			return (all as unknown as WishlistItem[]).length;
		},

		async getSummary() {
			const all = await data.findMany("wishlistItem", {});
			const items = all as unknown as WishlistItem[];

			const productCounts = new Map<
				string,
				{ productId: string; productName: string; count: number }
			>();

			for (const item of items) {
				const entry = productCounts.get(item.productId);
				if (entry) {
					entry.count += 1;
				} else {
					productCounts.set(item.productId, {
						productId: item.productId,
						productName: item.productName,
						count: 1,
					});
				}
			}

			const topProducts = Array.from(productCounts.values())
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			return {
				totalItems: items.length,
				topProducts,
			};
		},

		async createShareToken(customerId, expiresAt) {
			const id = crypto.randomUUID();
			const token = crypto.randomUUID().replace(/-/g, "");
			const share: WishlistShare = {
				id,
				customerId,
				token,
				active: true,
				createdAt: new Date(),
				expiresAt,
			};
			await data.upsert("wishlistShare", id, share as Record<string, unknown>);
			return share;
		},

		async revokeShareToken(customerId, tokenId) {
			const raw = await data.get("wishlistShare", tokenId);
			if (!raw) return false;
			const share = raw as unknown as WishlistShare;
			if (share.customerId !== customerId) return false;
			await data.upsert("wishlistShare", tokenId, {
				...share,
				active: false,
			} as Record<string, unknown>);
			return true;
		},

		async getShareTokens(customerId) {
			const all = await data.findMany("wishlistShare", {
				where: { customerId, active: true },
			});
			const shares = all as unknown as WishlistShare[];
			const now = new Date();
			return shares.filter((s) => !s.expiresAt || new Date(s.expiresAt) > now);
		},

		async getSharedWishlist(token) {
			const shares = await data.findMany("wishlistShare", {
				where: { token, active: true },
				take: 1,
			});
			const found = shares as unknown as WishlistShare[];
			if (found.length === 0) return null;
			const share = found[0];

			// Check expiry
			if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
				return null;
			}

			const items = await data.findMany("wishlistItem", {
				where: { customerId: share.customerId },
			});
			return items as unknown as WishlistItem[];
		},
	};
}
