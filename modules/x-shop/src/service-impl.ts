import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	extractTweetMetrics,
	XApiProvider,
	type XApiProviderConfig,
} from "./provider";
import type {
	ChannelOrder,
	ChannelStats,
	Listing,
	ProductDrop,
	XShopController,
} from "./service";

export function createXShopController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		apiKey?: string | undefined;
		apiSecret?: string | undefined;
		accessToken?: string | undefined;
		refreshToken?: string | undefined;
	},
): XShopController {
	const provider =
		options?.apiKey && options?.apiSecret && options?.accessToken
			? new XApiProvider({
					apiKey: options.apiKey,
					apiSecret: options.apiSecret,
					accessToken: options.accessToken,
					refreshToken: options.refreshToken,
				} satisfies XApiProviderConfig)
			: null;

	return {
		async createListing(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const listing: Listing = {
				id,
				localProductId: params.localProductId,
				externalProductId: params.externalProductId,
				title: params.title,
				status: params.status ?? "draft",
				syncStatus: params.syncStatus ?? "pending",
				lastSyncedAt: undefined,
				error: undefined,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("listing", id, listing as Record<string, unknown>);

			events?.emit("x.product.listed", {
				listingId: id,
				productId: params.localProductId,
				title: params.title,
			});

			return listing;
		},

		async updateListing(id, params) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as Listing;
			const now = new Date();

			const updated: Listing = {
				...listing,
				...(params.localProductId !== undefined
					? { localProductId: params.localProductId }
					: {}),
				...(params.externalProductId !== undefined
					? { externalProductId: params.externalProductId }
					: {}),
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.syncStatus !== undefined
					? { syncStatus: params.syncStatus }
					: {}),
				...(params.lastSyncedAt !== undefined
					? { lastSyncedAt: params.lastSyncedAt }
					: {}),
				...(params.error !== undefined ? { error: params.error } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: now,
			};

			await data.upsert("listing", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteListing(id) {
			const existing = await data.get("listing", id);
			if (!existing) return false;

			const listing = existing as unknown as Listing;
			await data.delete("listing", id);

			events?.emit("x.product.unlisted", {
				listingId: id,
				productId: listing.localProductId,
			});

			return true;
		},

		async getListing(id) {
			const raw = await data.get("listing", id);
			if (!raw) return null;
			return raw as unknown as Listing;
		},

		async getListingByProduct(localProductId) {
			const matches = await data.findMany("listing", {
				where: { localProductId },
				take: 1,
			});
			return (matches[0] as unknown as Listing) ?? null;
		},

		async listListings(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.syncStatus) where.syncStatus = params.syncStatus;

			const all = await data.findMany("listing", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as Listing[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: ChannelOrder = {
				id,
				externalOrderId: params.externalOrderId,
				status: params.status ?? "pending",
				items: params.items,
				subtotal: params.subtotal,
				shippingFee: params.shippingFee,
				platformFee: params.platformFee,
				total: params.total,
				customerName: params.customerName,
				shippingAddress: params.shippingAddress,
				trackingNumber: undefined,
				trackingUrl: undefined,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("channelOrder", id, order as Record<string, unknown>);

			events?.emit("x.order.received", {
				orderId: id,
				externalOrderId: params.externalOrderId,
				total: params.total,
			});

			return order;
		},

		async getOrder(id) {
			const raw = await data.get("channelOrder", id);
			if (!raw) return null;
			return raw as unknown as ChannelOrder;
		},

		async updateOrderStatus(id, status, trackingNumber, trackingUrl) {
			const existing = await data.get("channelOrder", id);
			if (!existing) return null;

			const order = existing as unknown as ChannelOrder;
			const now = new Date();

			const updated: ChannelOrder = {
				...order,
				status,
				...(trackingNumber !== undefined ? { trackingNumber } : {}),
				...(trackingUrl !== undefined ? { trackingUrl } : {}),
				updatedAt: now,
			};
			await data.upsert("channelOrder", id, updated as Record<string, unknown>);
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("channelOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as ChannelOrder[];
		},

		async createDrop(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			let tweetId = params.tweetId;

			// Post a tweet announcing the drop if provider is configured and drop is launching now
			if (provider && !tweetId && params.launchDate <= now) {
				try {
					const tweetText = params.description
						? `${params.name}\n\n${params.description}`
						: params.name;
					const result = await provider.postTweet(tweetText);
					tweetId = result.data.id;
				} catch {
					// Drop creation succeeds even if tweet fails
				}
			}

			const drop: ProductDrop = {
				id,
				name: params.name,
				description: params.description,
				productIds: params.productIds,
				launchDate: params.launchDate,
				endDate: params.endDate,
				status: params.launchDate <= now ? "live" : "scheduled",
				tweetId,
				impressions: 0,
				clicks: 0,
				conversions: 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("productDrop", id, drop as Record<string, unknown>);

			events?.emit("x.drop.launched", {
				dropId: id,
				name: params.name,
				tweetId,
				productCount: params.productIds.length,
			});

			return drop;
		},

		async getDrop(id) {
			const raw = await data.get("productDrop", id);
			if (!raw) return null;
			return raw as unknown as ProductDrop;
		},

		async cancelDrop(id) {
			const existing = await data.get("productDrop", id);
			if (!existing) return null;

			const drop = existing as unknown as ProductDrop;
			if (drop.status === "ended" || drop.status === "cancelled") {
				return drop;
			}

			// Delete the associated tweet if provider is configured
			if (provider && drop.tweetId) {
				try {
					await provider.deleteTweet(drop.tweetId);
				} catch {
					// Cancellation succeeds even if tweet deletion fails
				}
			}

			const now = new Date();
			const updated: ProductDrop = {
				...drop,
				status: "cancelled",
				updatedAt: now,
			};
			await data.upsert("productDrop", id, updated as Record<string, unknown>);
			return updated;
		},

		async listDrops(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("productDrop", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as ProductDrop[];
		},

		async getDropStats(id) {
			const raw = await data.get("productDrop", id);
			if (!raw) return null;

			const drop = raw as unknown as ProductDrop;

			// Fetch real-time metrics from X API if provider and tweetId are available
			if (provider && drop.tweetId) {
				try {
					const tweetRes = await provider.getTweet(drop.tweetId);
					const metrics = extractTweetMetrics(tweetRes.data);

					// Persist updated metrics locally
					const updated: ProductDrop = {
						...drop,
						impressions: metrics.impressions,
						clicks: metrics.clicks,
						updatedAt: new Date(),
					};
					await data.upsert(
						"productDrop",
						id,
						updated as Record<string, unknown>,
					);

					return {
						impressions: metrics.impressions,
						clicks: metrics.clicks,
						conversions: drop.conversions,
						conversionRate:
							metrics.clicks > 0
								? (drop.conversions / metrics.clicks) * 100
								: 0,
					};
				} catch {
					// Fall back to locally stored metrics
				}
			}

			return {
				impressions: drop.impressions,
				clicks: drop.clicks,
				conversions: drop.conversions,
				conversionRate:
					drop.clicks > 0 ? (drop.conversions / drop.clicks) * 100 : 0,
			};
		},

		async getChannelStats() {
			const listings = (await data.findMany(
				"listing",
				{},
			)) as unknown as Listing[];
			const orders = (await data.findMany(
				"channelOrder",
				{},
			)) as unknown as ChannelOrder[];

			const stats: ChannelStats = {
				totalListings: listings.length,
				activeListings: listings.filter((l) => l.status === "active").length,
				pendingListings: listings.filter((l) => l.status === "pending").length,
				failedListings: listings.filter((l) => l.syncStatus === "failed")
					.length,
				totalOrders: orders.length,
				pendingOrders: orders.filter((o) => o.status === "pending").length,
				shippedOrders: orders.filter((o) => o.status === "shipped").length,
				deliveredOrders: orders.filter((o) => o.status === "delivered").length,
				cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
				totalRevenue: orders
					.filter((o) => o.status !== "cancelled" && o.status !== "refunded")
					.reduce((sum, o) => sum + o.total, 0),
			};
			return stats;
		},
	};
}
