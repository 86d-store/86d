import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	AmazonProvider,
	type AmazonProviderConfig,
	mapFulfillmentChannel,
	mapOrderStatus,
	parseSpApiMoney,
} from "./provider";
import type {
	AmazonController,
	AmazonOrder,
	ChannelStats,
	InventoryHealth,
	InventorySync,
	Listing,
} from "./service";

export function createAmazonController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		sellerId?: string | undefined;
		clientId?: string | undefined;
		clientSecret?: string | undefined;
		refreshToken?: string | undefined;
		marketplaceId?: string | undefined;
		region?: string | undefined;
	},
): AmazonController {
	const marketplaceId = options?.marketplaceId ?? "";

	const provider =
		options?.sellerId &&
		options?.clientId &&
		options?.clientSecret &&
		options?.refreshToken &&
		marketplaceId
			? new AmazonProvider({
					sellerId: options.sellerId,
					marketplaceId,
					clientId: options.clientId,
					clientSecret: options.clientSecret,
					refreshToken: options.refreshToken,
					region: options.region,
				} satisfies AmazonProviderConfig)
			: null;

	return {
		async createListing(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const listing: Listing = {
				id,
				localProductId: params.localProductId,
				asin: params.asin,
				sku: params.sku,
				title: params.title,
				status: params.status ?? "incomplete",
				fulfillmentChannel: params.fulfillmentChannel ?? "FBM",
				price: params.price,
				quantity: params.quantity ?? 0,
				condition: params.condition ?? "new",
				buyBoxOwned: params.buyBoxOwned ?? false,
				error: params.error,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("listing", id, listing as Record<string, unknown>);
			return listing;
		},

		async updateListing(id, params) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as Listing;
			const now = new Date();

			const updated: Listing = {
				...listing,
				...(params.asin !== undefined ? { asin: params.asin } : {}),
				...(params.sku !== undefined ? { sku: params.sku } : {}),
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.fulfillmentChannel !== undefined
					? { fulfillmentChannel: params.fulfillmentChannel }
					: {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
				...(params.condition !== undefined
					? { condition: params.condition }
					: {}),
				...(params.buyBoxOwned !== undefined
					? { buyBoxOwned: params.buyBoxOwned }
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

			// If provider is configured, also delete from Amazon
			if (provider && listing.sku) {
				try {
					await provider.deleteListing(listing.sku);
				} catch {
					// Continue with local deletion even if API call fails
				}
			}

			await data.delete("listing", id);
			return true;
		},

		async getListing(id) {
			const raw = await data.get("listing", id);
			if (!raw) return null;
			return raw as unknown as Listing;
		},

		async getListingByProduct(productId) {
			const matches = await data.findMany("listing", {
				where: { localProductId: productId },
				take: 1,
			});
			return matches[0] as unknown as Listing;
		},

		async getListingByAsin(asin) {
			const matches = await data.findMany("listing", {
				where: { asin },
				take: 1,
			});
			return matches[0] as unknown as Listing;
		},

		async listListings(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.fulfillmentChannel)
				where.fulfillmentChannel = params.fulfillmentChannel;

			const all = await data.findMany("listing", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as Listing[];
		},

		async syncInventory() {
			const now = new Date();
			const id = crypto.randomUUID();

			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as Listing[];

			const sync: InventorySync = {
				id,
				status: provider ? "syncing" : "pending",
				totalSkus: listings.length,
				updatedSkus: 0,
				failedSkus: 0,
				startedAt: now,
				createdAt: now,
			};

			await data.upsert("inventorySync", id, sync as Record<string, unknown>);

			if (!provider) return sync;

			// Pull inventory data from Amazon via Listings Items API
			let updatedSkus = 0;
			let failedSkus = 0;

			for (const listing of listings) {
				try {
					const spItem = await provider.getListing(listing.sku);
					const availability = spItem.fulfillmentAvailability?.[0];
					if (availability) {
						const updatedListing: Listing = {
							...listing,
							quantity: availability.quantity,
							fulfillmentChannel: mapFulfillmentChannel(
								availability.fulfillmentChannelCode,
							),
							lastSyncedAt: new Date(),
							updatedAt: new Date(),
							error: undefined,
						};
						await data.upsert(
							"listing",
							listing.id,
							updatedListing as Record<string, unknown>,
						);
						updatedSkus++;
					}
				} catch (err) {
					failedSkus++;
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					const updatedListing: Listing = {
						...listing,
						error: errorMsg,
						updatedAt: new Date(),
					};
					await data.upsert(
						"listing",
						listing.id,
						updatedListing as Record<string, unknown>,
					);
				}
			}

			const completedSync: InventorySync = {
				...sync,
				status: failedSkus > 0 ? "failed" : "synced",
				updatedSkus,
				failedSkus,
				completedAt: new Date(),
			};

			await data.upsert(
				"inventorySync",
				id,
				completedSync as Record<string, unknown>,
			);

			events?.emit("amazon.inventory.updated", {
				syncId: id,
				updatedSkus,
				failedSkus,
			});

			return completedSync;
		},

		async getLastInventorySync() {
			const all = await data.findMany("inventorySync", {
				orderBy: { createdAt: "desc" },
				take: 1,
			});
			return all[0] as unknown as InventorySync;
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: AmazonOrder = {
				id,
				amazonOrderId: params.amazonOrderId,
				status: params.status ?? "pending",
				fulfillmentChannel: params.fulfillmentChannel ?? "FBM",
				items: params.items,
				orderTotal: params.orderTotal,
				shippingTotal: params.shippingTotal,
				marketplaceFee: params.marketplaceFee,
				netProceeds: params.netProceeds,
				buyerName: params.buyerName,
				shippingAddress: params.shippingAddress,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("amazonOrder", id, order as Record<string, unknown>);

			events?.emit("amazon.order.received", {
				orderId: order.id,
				amazonOrderId: order.amazonOrderId,
			});

			return order;
		},

		async getOrder(id) {
			const raw = await data.get("amazonOrder", id);
			if (!raw) return null;
			return raw as unknown as AmazonOrder;
		},

		async shipOrder(id, trackingNumber, carrier) {
			const existing = await data.get("amazonOrder", id);
			if (!existing) return null;

			const order = existing as unknown as AmazonOrder;
			const now = new Date();

			// Call Amazon SP-API to confirm shipment
			if (provider) {
				await provider.confirmShipment(order.amazonOrderId, {
					trackingNumber,
					carrierCode: carrier,
				});
			}

			const updated: AmazonOrder = {
				...order,
				status: "shipped",
				trackingNumber,
				carrier,
				shipDate: now,
				updatedAt: now,
			};

			await data.upsert("amazonOrder", id, updated as Record<string, unknown>);

			events?.emit("amazon.order.shipped", {
				orderId: id,
				amazonOrderId: order.amazonOrderId,
				trackingNumber,
				carrier,
			});

			return updated;
		},

		async cancelOrder(id) {
			const existing = await data.get("amazonOrder", id);
			if (!existing) return null;

			const order = existing as unknown as AmazonOrder;
			const now = new Date();

			const updated: AmazonOrder = {
				...order,
				status: "cancelled",
				updatedAt: now,
			};

			await data.upsert("amazonOrder", id, updated as Record<string, unknown>);
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.fulfillmentChannel)
				where.fulfillmentChannel = params.fulfillmentChannel;

			const all = await data.findMany("amazonOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as AmazonOrder[];
		},

		async getChannelStats() {
			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as Listing[];

			const allOrders = await data.findMany("amazonOrder", {});
			const orders = allOrders as unknown as AmazonOrder[];

			const stats: ChannelStats = {
				totalListings: listings.length,
				active: listings.filter((l) => l.status === "active").length,
				inactive: listings.filter((l) => l.status === "inactive").length,
				suppressed: listings.filter((l) => l.status === "suppressed").length,
				incomplete: listings.filter((l) => l.status === "incomplete").length,
				fba: listings.filter((l) => l.fulfillmentChannel === "FBA").length,
				fbm: listings.filter((l) => l.fulfillmentChannel === "FBM").length,
				totalOrders: orders.length,
				totalRevenue: orders.reduce((sum, o) => sum + o.orderTotal, 0),
			};

			return stats;
		},

		async getInventoryHealth() {
			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as Listing[];

			const health: InventoryHealth = {
				totalSkus: listings.length,
				lowStock: listings.filter((l) => l.quantity > 0 && l.quantity <= 5)
					.length,
				outOfStock: listings.filter((l) => l.quantity === 0).length,
				fbaCount: listings.filter((l) => l.fulfillmentChannel === "FBA").length,
				fbmCount: listings.filter((l) => l.fulfillmentChannel === "FBM").length,
			};

			return health;
		},

		async pushListing(id) {
			const existing = await data.get("listing", id);
			if (!existing) return null;
			if (!provider) return existing as unknown as Listing;

			const listing = existing as unknown as Listing;

			const conditionMap: Record<string, string> = {
				new: "new_new",
				"used-like-new": "used_like_new",
				"used-very-good": "used_very_good",
				"used-good": "used_good",
				"used-acceptable": "used_acceptable",
				refurbished: "refurbished_refurbished",
			};

			const attributes: Record<string, unknown[]> = {
				item_name: [
					{
						value: listing.title,
						marketplace_id: marketplaceId,
					},
				],
				condition_type: [
					{
						value: conditionMap[listing.condition] ?? "new_new",
						marketplace_id: marketplaceId,
					},
				],
				purchasable_offer: [
					{
						marketplace_id: marketplaceId,
						currency: "USD",
						our_price: [
							{
								schedule: [{ value_with_tax: listing.price }],
							},
						],
					},
				],
				fulfillment_availability: [
					{
						fulfillment_channel_code:
							listing.fulfillmentChannel === "FBA" ? "AMAZON_NA" : "DEFAULT",
						quantity: listing.quantity,
					},
				],
			};

			const result = await provider.putListing(
				listing.sku,
				"PRODUCT",
				attributes,
			);

			const asin = result.identifiers?.[0]?.asin ?? listing.asin;
			const hasErrors = result.issues?.some((i) => i.severity === "ERROR");

			const updatedListing: Listing = {
				...listing,
				asin,
				status: hasErrors ? "suppressed" : "active",
				lastSyncedAt: new Date(),
				updatedAt: new Date(),
				error: hasErrors
					? result.issues
							?.filter((i) => i.severity === "ERROR")
							.map((i) => i.message)
							.join("; ")
					: undefined,
				metadata: {
					...listing.metadata,
					submissionId: result.submissionId,
					submissionStatus: result.status,
				},
			};

			await data.upsert(
				"listing",
				id,
				updatedListing as Record<string, unknown>,
			);

			events?.emit(
				hasErrors ? "amazon.listing.suppressed" : "amazon.listing.synced",
				{ listingId: id, sku: listing.sku, asin },
			);

			return updatedListing;
		},

		async syncListings() {
			if (!provider) return { synced: 0 };

			let synced = 0;
			let pageToken: string | undefined;

			do {
				const result = await provider.searchListings({
					pageSize: 20,
					pageToken,
				});

				for (const item of result.items) {
					const summary = item.summaries?.[0];
					if (!summary) continue;

					const offer = item.offers?.[0];
					const availability = item.fulfillmentAvailability?.[0];

					// Check if we already have this listing locally
					const existingMatches = await data.findMany("listing", {
						where: { sku: item.sku },
						take: 1,
					});
					const existing = existingMatches[0] as unknown as Listing;

					const now = new Date();
					const listingData: Listing = {
						id: existing.id(),
						localProductId: existing.localProductId,
						asin: summary.asin,
						sku: item.sku,
						title: summary.itemName,
						status: summary.status?.includes("BUYABLE") ? "active" : "inactive",
						fulfillmentChannel: availability
							? mapFulfillmentChannel(availability.fulfillmentChannelCode)
							: existing.fulfillmentChannel,
						price: offer
							? Number.parseFloat(offer.price.amount)
							: existing.price,
						quantity: availability?.quantity ?? existing.quantity ?? 0,
						condition: existing.condition,
						buyBoxOwned: existing.buyBoxOwned,
						lastSyncedAt: now,
						error: undefined,
						metadata: existing.metadata,
						createdAt: existing.createdAt,
						updatedAt: now,
					};

					await data.upsert(
						"listing",
						listingData.id,
						listingData as Record<string, unknown>,
					);
					synced++;
				}

				pageToken = result.pagination.nextToken;
			} while (pageToken);

			return { synced };
		},

		async syncOrders(params) {
			if (!provider) return { synced: 0 };

			// Default to last 7 days if no createdAfter specified
			const createdAfter =
				params?.createdAfter ??
				new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

			let synced = 0;
			let nextToken: string | undefined;

			do {
				const result = await provider.getOrders({
					createdAfter,
					nextToken,
					maxResultsPerPage: 100,
				});

				for (const spOrder of result.Orders) {
					// Check if order already exists locally
					const existingMatches = await data.findMany("amazonOrder", {
						where: { amazonOrderId: spOrder.AmazonOrderId },
						take: 1,
					});
					const existing = existingMatches[0] as unknown as AmazonOrder;

					// Fetch order items for financial details
					let items: unknown[] = existing.items;
					let shippingTotal = existing.shippingTotal;
					try {
						const orderItems = await provider.getOrderItems(
							spOrder.AmazonOrderId,
						);
						items = orderItems.map((oi) => ({
							asin: oi.ASIN,
							sellerSku: oi.SellerSKU,
							title: oi.Title,
							quantityOrdered: oi.QuantityOrdered,
							quantityShipped: oi.QuantityShipped,
							itemPrice: parseSpApiMoney(oi.ItemPrice),
							itemTax: parseSpApiMoney(oi.ItemTax),
						}));
						shippingTotal = orderItems.reduce(
							(sum, oi) => sum + parseSpApiMoney(oi.ShippingPrice),
							0,
						);
					} catch {
						// Use existing items if fetching fails
					}

					const orderTotal = parseSpApiMoney(spOrder.OrderTotal);
					// Estimate marketplace fee as ~15% (actual fee varies by category)
					const marketplaceFee = existing.marketplaceFee * 0.15;
					const netProceeds = existing.netProceeds;
					orderTotal - shippingTotal - marketplaceFee;

					const now = new Date();
					const orderData: AmazonOrder = {
						id: existing.id(),
						amazonOrderId: spOrder.AmazonOrderId,
						status: mapOrderStatus(spOrder.OrderStatus),
						fulfillmentChannel: mapFulfillmentChannel(
							spOrder.FulfillmentChannel,
						),
						items,
						orderTotal,
						shippingTotal,
						marketplaceFee,
						netProceeds,
						buyerName: spOrder.BuyerInfo?.BuyerName,
						shippingAddress: spOrder.ShippingAddress
							? {
									name: spOrder.ShippingAddress.Name,
									line1: spOrder.ShippingAddress.AddressLine1,
									line2: spOrder.ShippingAddress.AddressLine2,
									city: spOrder.ShippingAddress.City,
									state: spOrder.ShippingAddress.StateOrRegion,
									postalCode: spOrder.ShippingAddress.PostalCode,
									country: spOrder.ShippingAddress.CountryCode,
								}
							: existing.shippingAddress,
						shipDate: existing.shipDate,
						trackingNumber: existing.trackingNumber,
						carrier: existing.carrier,
						createdAt: existing.createdAt,
						updatedAt: now,
					};

					await data.upsert(
						"amazonOrder",
						orderData.id,
						orderData as Record<string, unknown>,
					);
					synced++;
				}

				nextToken = result.NextToken;
			} while (nextToken);

			return { synced };
		},
	};
}
