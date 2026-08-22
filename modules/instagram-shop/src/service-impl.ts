import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	MetaInstagramProvider,
	type MetaInstagramProviderConfig,
	mapMetaOrderStatus,
	parseMetaMoney,
} from "./provider";
import type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	InstagramShopController,
	Listing,
} from "./service";

export function createInstagramShopController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		accessToken?: string | undefined;
		catalogId?: string | undefined;
		commerceAccountId?: string | undefined;
		businessId?: string | undefined;
	},
): InstagramShopController {
	const provider =
		options?.accessToken && options?.catalogId && options?.commerceAccountId
			? new MetaInstagramProvider({
					accessToken: options.accessToken,
					catalogId: options.catalogId,
					commerceAccountId: options.commerceAccountId,
					businessId: options.businessId,
				} satisfies MetaInstagramProviderConfig)
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
				description: params.description,
				price: params.price,
				imageUrl: params.imageUrl,
				status: params.status ?? "draft",
				syncStatus: params.syncStatus ?? "pending",
				lastSyncedAt: undefined,
				error: undefined,
				instagramMediaIds: [],
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
				...(params.localProductId !== undefined
					? { localProductId: params.localProductId }
					: {}),
				...(params.externalProductId !== undefined
					? { externalProductId: params.externalProductId }
					: {}),
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.imageUrl !== undefined ? { imageUrl: params.imageUrl } : {}),
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

			// Delete from catalog if provider configured and has external ID
			if (provider && listing.externalProductId) {
				try {
					await provider.deleteProduct(listing.externalProductId);
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

		async getListingByProduct(localProductId) {
			const matches = await data.findMany("listing", {
				where: { localProductId },
				take: 1,
			});
			return matches[0] as unknown as Listing;
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

		async tagProduct(listingId, mediaId) {
			const existing = await data.get("listing", listingId);
			if (!existing) return null;

			const listing = existing as unknown as Listing;
			const mediaIds = [...listing.instagramMediaIds];
			if (!mediaIds.includes(mediaId)) {
				mediaIds.push(mediaId);
			}

			const updated: Listing = {
				...listing,
				instagramMediaIds: mediaIds,
				updatedAt: new Date(),
			};
			await data.upsert(
				"listing",
				listingId,
				updated as Record<string, unknown>,
			);

			events?.emit("instagram.product.tagged", {
				listingId,
				mediaId,
			});

			return updated;
		},

		async untagProduct(listingId, mediaId) {
			const existing = await data.get("listing", listingId);
			if (!existing) return null;

			const listing = existing as unknown as Listing;
			const mediaIds = listing.instagramMediaIds.filter(
				(id: string) => id !== mediaId,
			);

			const updated: Listing = {
				...listing,
				instagramMediaIds: mediaIds,
				updatedAt: new Date(),
			};
			await data.upsert(
				"listing",
				listingId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async getProductTags(listingId) {
			const existing = await data.get("listing", listingId);
			if (!existing) return [];

			const listing = existing as unknown as Listing;
			return listing.instagramMediaIds;
		},

		async syncCatalog() {
			const now = new Date();
			const id = crypto.randomUUID();

			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as Listing[];

			const sync: CatalogSync = {
				id,
				status: provider ? "syncing" : "pending",
				totalProducts: listings.length,
				syncedProducts: 0,
				failedProducts: 0,
				startedAt: now,
				completedAt: undefined,
				createdAt: now,
			};
			await data.upsert("catalogSync", id, sync as Record<string, unknown>);

			if (!provider) return sync;

			let syncedProducts = 0;
			let failedProducts = 0;

			for (const listing of listings) {
				try {
					if (listing.externalProductId) {
						await provider.updateProduct(listing.externalProductId, {
							name: listing.title,
						});
					} else if (!listing.imageUrl) {
						failedProducts++;
						const updatedListing: Listing = {
							...listing,
							syncStatus: "failed",
							error:
								"No image URL provided — set imageUrl on the listing before syncing",
							updatedAt: new Date(),
						};
						await data.upsert(
							"listing",
							listing.id,
							updatedListing as Record<string, unknown>,
						);
						continue;
					} else {
						const result = await provider.createProduct({
							retailer_id: listing.localProductId,
							name: listing.title,
							description: listing.description ?? listing.title,
							price: listing.price ?? 0,
							image_url: listing.imageUrl,
						});
						const updatedListing: Listing = {
							...listing,
							externalProductId: result.id,
							syncStatus: "synced",
							lastSyncedAt: new Date(),
							updatedAt: new Date(),
							error: undefined,
						};
						await data.upsert(
							"listing",
							listing.id,
							updatedListing as Record<string, unknown>,
						);
					}
					syncedProducts++;
				} catch (err) {
					failedProducts++;
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					const updatedListing: Listing = {
						...listing,
						syncStatus: "failed",
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

			const completedSync: CatalogSync = {
				...sync,
				status: failedProducts > 0 ? "failed" : "synced",
				syncedProducts,
				failedProducts,
				completedAt: new Date(),
			};
			await data.upsert(
				"catalogSync",
				id,
				completedSync as Record<string, unknown>,
			);

			events?.emit("instagram.catalog.synced", {
				syncId: id,
				syncedProducts,
				failedProducts,
			});

			return completedSync;
		},

		async getLastSync() {
			const all = await data.findMany("catalogSync", {
				orderBy: { createdAt: "desc" },
				take: 1,
			});
			return all[0] as unknown as CatalogSync;
		},

		async listSyncs(params) {
			const all = await data.findMany("catalogSync", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as CatalogSync[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: ChannelOrder = {
				id,
				externalOrderId: params.externalOrderId,
				instagramOrderId: params.instagramOrderId,
				igUsername: params.igUsername,
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

			events?.emit("instagram.order.received", {
				orderId: order.id,
				externalOrderId: order.externalOrderId,
				instagramOrderId: order.instagramOrderId,
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

			// If shipping with tracking, call Meta API to create shipment
			if (
				provider &&
				status === "shipped" &&
				trackingNumber &&
				order.externalOrderId
			) {
				try {
					const items = order.items as {
						retailer_id: string;
						quantity: number;
					}[];
					await provider.createShipment(order.externalOrderId, {
						trackingNumber,
						carrier: "OTHER",
						items: items.map((i) => ({
							retailer_id: i.retailer_id,
							quantity: i.quantity,
						})),
					});
				} catch {
					// Continue with local update even if API call fails
				}
			}

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

		async pushProduct(id) {
			const existing = await data.get("listing", id);
			if (!existing) return null;
			if (!provider) return existing as unknown as Listing;

			const listing = existing as unknown as Listing;

			try {
				if (listing.externalProductId) {
					await provider.updateProduct(listing.externalProductId, {
						name: listing.title,
					});
				} else if (!listing.imageUrl) {
					const updatedListing: Listing = {
						...listing,
						syncStatus: "failed",
						error:
							"No image URL provided — set imageUrl on the listing before pushing",
						updatedAt: new Date(),
					};
					await data.upsert(
						"listing",
						id,
						updatedListing as Record<string, unknown>,
					);
					return updatedListing;
				} else {
					const result = await provider.createProduct({
						retailer_id: listing.localProductId,
						name: listing.title,
						description: listing.description ?? listing.title,
						price: listing.price ?? 0,
						image_url: listing.imageUrl,
					});
					listing.externalProductId = result.id;
				}

				const updatedListing: Listing = {
					...listing,
					status: "active",
					syncStatus: "synced",
					lastSyncedAt: new Date(),
					updatedAt: new Date(),
					error: undefined,
				};

				await data.upsert(
					"listing",
					id,
					updatedListing as Record<string, unknown>,
				);

				events?.emit("instagram.product.synced", {
					listingId: id,
					externalProductId: updatedListing.externalProductId,
				});

				return updatedListing;
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : "Unknown error";
				const updatedListing: Listing = {
					...listing,
					syncStatus: "failed",
					error: errorMsg,
					updatedAt: new Date(),
				};
				await data.upsert(
					"listing",
					id,
					updatedListing as Record<string, unknown>,
				);
				return updatedListing;
			}
		},

		async syncProducts() {
			if (!provider) return { synced: 0 };

			let synced = 0;
			let after: string | undefined;

			do {
				const result = await provider.listProducts({
					limit: 50,
					after,
				});

				for (const product of result.data) {
					const existingMatches = await data.findMany("listing", {
						where: { externalProductId: product.id },
						take: 1,
					});
					const existing = existingMatches[0] as unknown as Listing;

					const now = new Date();
					const listingData: Listing = {
						id: existing.id(),
						localProductId: existing.localProductId,
						externalProductId: product.id,
						title: product.name,
						status: product.visibility === "published" ? "active" : "draft",
						syncStatus: "synced",
						lastSyncedAt: now,
						error: undefined,
						instagramMediaIds: existing.instagramMediaIds,
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

				after = result.paging?.cursors?.after;
			} while (after);

			return { synced };
		},

		async syncOrders() {
			if (!provider) return { synced: 0 };

			let synced = 0;
			const result = await provider.listOrders({
				state: "CREATED,IN_PROGRESS",
			});

			for (const metaOrder of result.data) {
				const existingMatches = await data.findMany("channelOrder", {
					where: { externalOrderId: metaOrder.id },
					take: 1,
				});
				const existing = existingMatches[0] as unknown as ChannelOrder;

				const items =
					metaOrder.items?.data.map((i) => ({
						product_id: i.product_id,
						retailer_id: i.retailer_id,
						quantity: i.quantity,
						price: parseMetaMoney(i.price_per_unit.amount),
					})) ?? [];

				const subtotal = parseMetaMoney(
					metaOrder.estimated_payment_details?.subtotal?.amount,
				);
				const shippingFee = parseMetaMoney(
					metaOrder.estimated_payment_details?.shipping?.amount,
				);
				const _tax = parseMetaMoney(
					metaOrder.estimated_payment_details?.tax?.amount,
				);
				const total = parseMetaMoney(
					metaOrder.estimated_payment_details?.total_amount?.amount,
				);

				const now = new Date();
				const orderData: ChannelOrder = {
					id: existing.id(),
					externalOrderId: metaOrder.id,
					instagramOrderId: existing.instagramOrderId,
					igUsername: existing.igUsername,
					status: mapMetaOrderStatus(metaOrder.order_status.state),
					items,
					subtotal,
					shippingFee,
					platformFee: existing.platformFee,
					total,
					customerName: metaOrder.buyer_details?.name,
					shippingAddress: metaOrder.shipping_address
						? {
								name: metaOrder.shipping_address.name,
								street1: metaOrder.shipping_address.street1,
								street2: metaOrder.shipping_address.street2,
								city: metaOrder.shipping_address.city,
								state: metaOrder.shipping_address.state,
								postalCode: metaOrder.shipping_address.postal_code,
								country: metaOrder.shipping_address.country,
							}
						: existing.shippingAddress,
					trackingNumber: existing.trackingNumber,
					trackingUrl: existing.trackingUrl,
					createdAt: existing.createdAt,
					updatedAt: now,
				};

				await data.upsert(
					"channelOrder",
					orderData.id,
					orderData as Record<string, unknown>,
				);
				synced++;
			}

			return { synced };
		},
	};
}
