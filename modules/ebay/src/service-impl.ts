import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	EbayProvider,
	type EbayProviderConfig,
	mapOrderStatus,
	parseEbayMoney,
} from "./provider";
import type {
	ChannelStats,
	EbayController,
	EbayListing,
	EbayOrder,
} from "./service";

export function createEbayController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		clientId?: string | undefined;
		clientSecret?: string | undefined;
		refreshToken?: string | undefined;
		siteId?: string | undefined;
		currency?: string | undefined;
		sandbox?: boolean | undefined;
	},
): EbayController {
	const provider =
		options?.clientId && options?.clientSecret && options?.refreshToken
			? new EbayProvider({
					clientId: options.clientId,
					clientSecret: options.clientSecret,
					refreshToken: options.refreshToken,
					siteId: options.siteId,
					currency: options.currency,
					sandbox: options.sandbox,
				} satisfies EbayProviderConfig)
			: null;

	return {
		async createListing(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const sku = `86d-${id.slice(0, 8)}`;

			const listing: EbayListing = {
				id,
				localProductId: params.localProductId,
				title: params.title,
				status: "draft",
				listingType: params.listingType ?? "fixed-price",
				price: params.price,
				auctionStartPrice: params.auctionStartPrice,
				currentBid: undefined,
				bidCount: 0,
				quantity: params.quantity ?? 1,
				condition: params.condition ?? "new",
				categoryId: params.categoryId,
				duration: params.duration,
				startTime: undefined,
				endTime: undefined,
				watchers: 0,
				views: 0,
				lastSyncedAt: undefined,
				error: undefined,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			if (provider) {
				try {
					await provider.createOrUpdateInventoryItem(sku, {
						title: params.title,
						condition: params.condition ?? "new",
						quantity: params.quantity ?? 1,
					});

					const offerRes = await provider.createOffer({
						sku,
						price: params.price,
						quantity: params.quantity ?? 1,
						format: params.listingType ?? "fixed-price",
						categoryId: params.categoryId,
						auctionStartPrice: params.auctionStartPrice,
					});

					const publishRes = await provider.publishOffer(offerRes.offerId);

					listing.ebayItemId = publishRes.listingId;
					listing.status = "active";
					listing.startTime = now;
					listing.lastSyncedAt = now;
					listing.metadata = {
						...listing.metadata,
						sku,
						offerId: offerRes.offerId,
					};
				} catch (err) {
					listing.status = "error";
					listing.error = err instanceof Error ? err.message : "Unknown error";
				}
			}

			await data.upsert("listing", id, listing as Record<string, unknown>);
			events?.emit("ebay.listing.created", { listingId: id });
			return listing;
		},

		async updateListing(id, params) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as EbayListing;
			const now = new Date();

			const updated: EbayListing = {
				...listing,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
				...(params.condition !== undefined
					? { condition: params.condition }
					: {}),
				...(params.categoryId !== undefined
					? { categoryId: params.categoryId }
					: {}),
				...(params.duration !== undefined ? { duration: params.duration } : {}),
				...(params.ebayItemId !== undefined
					? { ebayItemId: params.ebayItemId }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: now,
			};

			if (provider && listing.metadata?.offerId) {
				try {
					const offerId = listing.metadata.offerId as string;
					await provider.updateOffer(offerId, {
						price: params.price,
						quantity: params.quantity,
						categoryId: params.categoryId,
					});
					updated.lastSyncedAt = now;
					updated.error = undefined;
				} catch (err) {
					updated.error = err instanceof Error ? err.message : "Unknown error";
				}
			}

			await data.upsert("listing", id, updated as Record<string, unknown>);
			return updated;
		},

		async endListing(id) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as EbayListing;
			const now = new Date();

			if (provider && listing.metadata?.offerId) {
				try {
					const offerId = listing.metadata.offerId as string;
					await provider.withdrawOffer(offerId);
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: EbayListing = {
				...listing,
				status: "ended",
				endTime: now,
				updatedAt: now,
			};

			await data.upsert("listing", id, updated as Record<string, unknown>);
			events?.emit("ebay.listing.ended", { listingId: id });
			return updated;
		},

		async getListing(id) {
			const raw = await data.get("listing", id);
			if (!raw) return null;
			return raw as unknown as EbayListing;
		},

		async getListingByProduct(productId) {
			const matches = await data.findMany("listing", {
				where: { localProductId: productId },
				take: 1,
			});
			return (matches[0] as unknown as EbayListing) ?? null;
		},

		async listListings(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.listingType) where.listingType = params.listingType;

			const all = await data.findMany("listing", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as EbayListing[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: EbayOrder = {
				id,
				ebayOrderId: params.ebayOrderId,
				status: "pending",
				items: params.items,
				subtotal: params.subtotal,
				shippingCost: params.shippingCost,
				ebayFee: params.ebayFee,
				paymentProcessingFee: params.paymentProcessingFee,
				total: params.total,
				buyerUsername: params.buyerUsername,
				buyerName: params.buyerName,
				shippingAddress: params.shippingAddress ?? {},
				trackingNumber: undefined,
				carrier: undefined,
				shipDate: undefined,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("ebayOrder", id, order as Record<string, unknown>);
			events?.emit("ebay.order.received", {
				orderId: id,
				ebayOrderId: params.ebayOrderId,
			});
			return order;
		},

		async getOrder(id) {
			const raw = await data.get("ebayOrder", id);
			if (!raw) return null;
			return raw as unknown as EbayOrder;
		},

		async shipOrder(id, trackingNumber, carrier) {
			const existing = await data.get("ebayOrder", id);
			if (!existing) return null;

			const order = existing as unknown as EbayOrder;
			const now = new Date();

			if (provider && order.ebayOrderId) {
				try {
					const apiOrder = await provider.getOrder(order.ebayOrderId);
					const lineItemIds = apiOrder.lineItems.map((li) => li.lineItemId);
					await provider.createShippingFulfillment(order.ebayOrderId, {
						trackingNumber,
						carrier,
						lineItemIds,
					});
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: EbayOrder = {
				...order,
				status: "shipped",
				trackingNumber,
				carrier,
				shipDate: now,
				updatedAt: now,
			};

			await data.upsert("ebayOrder", id, updated as Record<string, unknown>);
			events?.emit("ebay.order.shipped", {
				orderId: id,
				trackingNumber,
			});
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("ebayOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as EbayOrder[];
		},

		async syncOrders() {
			if (!provider) return [];

			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const synced: EbayOrder[] = [];

			try {
				const response = await provider.getOrders({
					filter: `creationdate:[${thirtyDaysAgo.toISOString()}..${now.toISOString()}]`,
					limit: 50,
				});

				for (const apiOrder of response.orders) {
					const existing = await data.findMany("ebayOrder", {
						where: { ebayOrderId: apiOrder.orderId },
						take: 1,
					});

					const status = mapOrderStatus(
						apiOrder.orderFulfillmentStatus,
						apiOrder.orderPaymentStatus,
						apiOrder.cancelStatus?.cancelState,
					);

					const shipping =
						apiOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;

					const shippingAddress: Record<string, unknown> =
						shipping?.contactAddress
							? {
									name: shipping.fullName ?? "",
									address1: shipping.contactAddress.addressLine1 ?? "",
									address2: shipping.contactAddress.addressLine2 ?? "",
									city: shipping.contactAddress.city ?? "",
									state: shipping.contactAddress.stateOrProvince ?? "",
									postalCode: shipping.contactAddress.postalCode ?? "",
									country: shipping.contactAddress.countryCode ?? "",
								}
							: {};

					const subtotal = parseEbayMoney(
						apiOrder.pricingSummary.priceSubtotal,
					);
					const deliveryCost = parseEbayMoney(
						apiOrder.pricingSummary.deliveryCost,
					);
					const total = parseEbayMoney(apiOrder.pricingSummary.total);

					const items = apiOrder.lineItems.map((li) => ({
						lineItemId: li.lineItemId,
						title: li.title,
						quantity: li.quantity,
						price: parseEbayMoney(li.lineItemCost),
						sku: li.sku,
					}));

					const orderData: EbayOrder = {
						id:
							existing.length > 0
								? (existing[0] as unknown as EbayOrder).id
								: crypto.randomUUID(),
						ebayOrderId: apiOrder.orderId,
						status,
						items,
						subtotal,
						shippingCost: deliveryCost,
						ebayFee: 0,
						paymentProcessingFee: 0,
						total,
						buyerUsername: apiOrder.buyer.username,
						buyerName: apiOrder.buyer.buyerRegistrationAddress?.fullName,
						shippingAddress,
						trackingNumber: undefined,
						carrier: undefined,
						shipDate: undefined,
						createdAt:
							existing.length > 0
								? (existing[0] as unknown as EbayOrder).createdAt
								: new Date(apiOrder.creationDate),
						updatedAt: now,
					};

					const orderRecord = orderData as Record<string, unknown>;
					await data.upsert("ebayOrder", orderData.id, orderRecord);
					synced.push(orderData);
				}

				events?.emit("ebay.catalog.synced", {
					orderCount: synced.length,
				});
			} catch {
				// Sync failure is non-fatal
			}

			return synced;
		},

		async getChannelStats() {
			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as EbayListing[];
			const allOrders = await data.findMany("ebayOrder", {});
			const orders = allOrders as unknown as EbayOrder[];

			const activeListings = listings.filter((l) => l.status === "active");
			const activeAuctions = listings.filter(
				(l) => l.status === "active" && l.listingType === "auction",
			);
			const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
			const averagePrice =
				activeListings.length > 0
					? activeListings.reduce((sum, l) => sum + l.price, 0) /
						activeListings.length
					: 0;

			const stats: ChannelStats = {
				totalListings: listings.length,
				activeListings: activeListings.length,
				totalOrders: orders.length,
				totalRevenue,
				activeAuctions: activeAuctions.length,
				averagePrice,
			};

			return stats;
		},

		async getActiveAuctions() {
			const all = await data.findMany("listing", {
				where: { status: "active", listingType: "auction" },
			});
			return all as unknown as EbayListing[];
		},
	};
}
