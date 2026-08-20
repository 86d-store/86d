import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	EtsyProvider,
	etsyMoney,
	mapEtsyStateToStatus,
	mapWhoMadeFromApi,
	mapWhoMadeToApi,
} from "./provider";
import type {
	ChannelStats,
	EtsyController,
	EtsyListing,
	EtsyOrder,
	EtsyReview,
} from "./service";

interface EtsyControllerOptions {
	apiKey?: string | undefined;
	shopId?: string | undefined;
	accessToken?: string | undefined;
}

export function createEtsyController(
	data: ModuleDataService,
	_events?: ScopedEventEmitter | undefined,
	options?: EtsyControllerOptions | undefined,
): EtsyController {
	const provider =
		options?.apiKey && options?.shopId && options?.accessToken
			? new EtsyProvider(options.apiKey, options.shopId, options.accessToken)
			: null;
	return {
		async createListing(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const listing: EtsyListing = {
				id,
				localProductId: params.localProductId,
				etsyListingId: params.etsyListingId,
				title: params.title,
				description: params.description,
				status: params.status ?? "draft",
				state: params.state ?? "draft",
				price: params.price,
				quantity: params.quantity ?? 0,
				renewalDate: params.renewalDate,
				whoMadeIt: params.whoMadeIt ?? "i-did",
				whenMadeIt: params.whenMadeIt ?? "made_to_order",
				isSupply: params.isSupply ?? false,
				materials: params.materials ?? [],
				tags: params.tags ?? [],
				taxonomyId: params.taxonomyId,
				shippingProfileId: params.shippingProfileId,
				views: 0,
				favorites: 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"listing",
				id,
				listing as unknown as Record<string, unknown>,
			);
			return listing;
		},

		async updateListing(id, params) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as EtsyListing;
			const now = new Date();

			const updated: EtsyListing = {
				...listing,
				...(params.etsyListingId !== undefined
					? { etsyListingId: params.etsyListingId }
					: {}),
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.state !== undefined ? { state: params.state } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
				...(params.renewalDate !== undefined
					? { renewalDate: params.renewalDate }
					: {}),
				...(params.whoMadeIt !== undefined
					? { whoMadeIt: params.whoMadeIt }
					: {}),
				...(params.whenMadeIt !== undefined
					? { whenMadeIt: params.whenMadeIt }
					: {}),
				...(params.isSupply !== undefined ? { isSupply: params.isSupply } : {}),
				...(params.materials !== undefined
					? { materials: params.materials }
					: {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.taxonomyId !== undefined
					? { taxonomyId: params.taxonomyId }
					: {}),
				...(params.shippingProfileId !== undefined
					? { shippingProfileId: params.shippingProfileId }
					: {}),
				...(params.error !== undefined ? { error: params.error } : {}),
				updatedAt: now,
			};

			await data.upsert(
				"listing",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteListing(id) {
			const existing = await data.get("listing", id);
			if (!existing) return false;
			await data.delete("listing", id);
			return true;
		},

		async getListing(id) {
			const raw = await data.get("listing", id);
			if (!raw) return null;
			return raw as unknown as EtsyListing;
		},

		async getListingByProduct(productId) {
			const matches = await data.findMany("listing", {
				where: { localProductId: productId },
				take: 1,
			});
			return (matches[0] as unknown as EtsyListing) ?? null;
		},

		async listListings(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("listing", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as EtsyListing[];
		},

		async renewListing(id) {
			const existing = await data.get("listing", id);
			if (!existing) return null;

			const listing = existing as unknown as EtsyListing;
			const now = new Date();
			const renewalDate = new Date(now);
			renewalDate.setDate(renewalDate.getDate() + 120);

			const updated: EtsyListing = {
				...listing,
				status: "active",
				state: "active",
				renewalDate,
				updatedAt: now,
			};

			await data.upsert(
				"listing",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: EtsyOrder = {
				id,
				etsyReceiptId: params.etsyReceiptId,
				status: params.status ?? "open",
				items: params.items,
				subtotal: params.subtotal,
				shippingCost: params.shippingCost,
				etsyFee: params.etsyFee,
				processingFee: params.processingFee,
				tax: params.tax,
				total: params.total,
				buyerName: params.buyerName,
				buyerEmail: params.buyerEmail,
				shippingAddress: params.shippingAddress,
				giftMessage: params.giftMessage,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"etsyOrder",
				id,
				order as unknown as Record<string, unknown>,
			);
			return order;
		},

		async getOrder(id) {
			const raw = await data.get("etsyOrder", id);
			if (!raw) return null;
			return raw as unknown as EtsyOrder;
		},

		async shipOrder(id, trackingNumber, carrier) {
			const existing = await data.get("etsyOrder", id);
			if (!existing) return null;

			const order = existing as unknown as EtsyOrder;
			const now = new Date();

			const updated: EtsyOrder = {
				...order,
				status: "shipped",
				trackingNumber,
				carrier,
				shipDate: now,
				updatedAt: now,
			};

			await data.upsert(
				"etsyOrder",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("etsyOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as EtsyOrder[];
		},

		async receiveReview(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const review: EtsyReview = {
				id,
				etsyTransactionId: params.etsyTransactionId,
				rating: params.rating,
				review: params.review,
				buyerName: params.buyerName,
				listingId: params.listingId,
				createdAt: now,
			};

			await data.upsert(
				"etsyReview",
				id,
				review as unknown as Record<string, unknown>,
			);
			return review;
		},

		async listReviews(params) {
			const all = await data.findMany("etsyReview", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as EtsyReview[];
		},

		async getAverageRating() {
			const all = await data.findMany("etsyReview", {});
			const reviews = all as unknown as EtsyReview[];
			if (reviews.length === 0) return 0;
			const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
			return Math.round((sum / reviews.length) * 100) / 100;
		},

		async getChannelStats() {
			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as EtsyListing[];

			const allOrders = await data.findMany("etsyOrder", {});
			const orders = allOrders as unknown as EtsyOrder[];

			const allReviews = await data.findMany("etsyReview", {});
			const reviews = allReviews as unknown as EtsyReview[];

			const avgRating =
				reviews.length > 0
					? Math.round(
							(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) *
								100,
						) / 100
					: 0;

			const stats: ChannelStats = {
				totalListings: listings.length,
				active: listings.filter((l) => l.status === "active").length,
				draft: listings.filter((l) => l.status === "draft").length,
				expired: listings.filter((l) => l.status === "expired").length,
				inactive: listings.filter((l) => l.status === "inactive").length,
				soldOut: listings.filter((l) => l.status === "sold-out").length,
				totalOrders: orders.length,
				totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
				totalViews: listings.reduce((sum, l) => sum + l.views, 0),
				totalFavorites: listings.reduce((sum, l) => sum + l.favorites, 0),
				averageRating: avgRating,
				totalReviews: reviews.length,
			};

			return stats;
		},

		async getExpiringListings(daysAhead) {
			const allListings = await data.findMany("listing", {});
			const listings = allListings as unknown as EtsyListing[];

			const now = new Date();
			const cutoff = new Date(now);
			cutoff.setDate(cutoff.getDate() + daysAhead);

			return listings.filter(
				(l) =>
					l.renewalDate &&
					new Date(l.renewalDate) <= cutoff &&
					new Date(l.renewalDate) >= now &&
					l.status === "active",
			);
		},

		async pushListing(id) {
			if (!provider) return null;

			const existing = await data.get("listing", id);
			if (!existing) return null;
			const listing = existing as unknown as EtsyListing;

			const now = new Date();

			if (listing.etsyListingId) {
				// Update existing Etsy listing
				const apiListing = await provider.updateListing(
					Number(listing.etsyListingId),
					{
						title: listing.title,
						description: listing.description,
						price: listing.price,
						quantity: listing.quantity,
						state:
							listing.state === "active"
								? "active"
								: listing.state === "inactive"
									? "inactive"
									: "draft",
						materials: listing.materials,
						tags: listing.tags,
					},
				);

				const updated: EtsyListing = {
					...listing,
					views: apiListing.views,
					favorites: apiListing.num_favorers,
					status: mapEtsyStateToStatus(apiListing.state),
					lastSyncedAt: now,
					updatedAt: now,
					error: undefined,
				};

				await data.upsert(
					"listing",
					id,
					updated as unknown as Record<string, unknown>,
				);
				return updated;
			}

			// Create new listing on Etsy
			const apiListing = await provider.createListing({
				title: listing.title,
				description: listing.description ?? "",
				price: listing.price,
				quantity: listing.quantity,
				who_made: mapWhoMadeToApi(listing.whoMadeIt),
				when_made: listing.whenMadeIt,
				is_supply: listing.isSupply,
				taxonomy_id: listing.taxonomyId ? Number(listing.taxonomyId) : 0,
				...(listing.shippingProfileId
					? {
							shipping_profile_id: Number(listing.shippingProfileId),
						}
					: {}),
				materials: listing.materials,
				tags: listing.tags,
				state: listing.state === "active" ? "active" : "draft",
			});

			const updated: EtsyListing = {
				...listing,
				etsyListingId: String(apiListing.listing_id),
				status: mapEtsyStateToStatus(apiListing.state),
				views: apiListing.views,
				favorites: apiListing.num_favorers,
				lastSyncedAt: now,
				updatedAt: now,
				error: undefined,
			};

			await data.upsert(
				"listing",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async syncListings() {
			if (!provider) return { synced: 0 };

			const response = await provider.getListings({ limit: 100 });
			const now = new Date();
			let synced = 0;

			for (const apiListing of response.results) {
				// Find local listing by Etsy ID
				const etsyId = String(apiListing.listing_id);
				const matches = await data.findMany("listing", {
					where: { etsyListingId: etsyId },
					take: 1,
				});

				const existing = matches[0] as unknown as EtsyListing | undefined;
				const listing: EtsyListing = {
					id: existing?.id ?? crypto.randomUUID(),
					localProductId: existing?.localProductId ?? "",
					etsyListingId: etsyId,
					title: apiListing.title,
					description: apiListing.description,
					status: mapEtsyStateToStatus(apiListing.state),
					state:
						apiListing.state === "active"
							? "active"
							: apiListing.state === "draft"
								? "draft"
								: "inactive",
					price: etsyMoney(apiListing.price),
					quantity: apiListing.quantity,
					whoMadeIt: mapWhoMadeFromApi(apiListing.who_made),
					whenMadeIt: apiListing.when_made,
					isSupply: apiListing.is_supply,
					materials: apiListing.materials,
					tags: apiListing.tags,
					taxonomyId: apiListing.taxonomy_id
						? String(apiListing.taxonomy_id)
						: undefined,
					shippingProfileId: apiListing.shipping_profile_id
						? String(apiListing.shipping_profile_id)
						: undefined,
					views: apiListing.views,
					favorites: apiListing.num_favorers,
					renewalDate: new Date(apiListing.ending_tsz * 1000),
					lastSyncedAt: now,
					createdAt:
						existing?.createdAt ?? new Date(apiListing.creation_tsz * 1000),
					updatedAt: now,
				};

				await data.upsert(
					"listing",
					listing.id,
					listing as unknown as Record<string, unknown>,
				);
				synced++;
			}

			return { synced };
		},

		async syncOrders() {
			if (!provider) return { synced: 0 };

			const response = await provider.getReceipts({ limit: 25 });
			const now = new Date();
			let synced = 0;

			for (const receipt of response.results) {
				const etsyReceiptId = String(receipt.receipt_id);

				// Check if we already have this order
				const matches = await data.findMany("etsyOrder", {
					where: { etsyReceiptId },
					take: 1,
				});

				const existing = matches[0] as unknown as EtsyOrder | undefined;
				const id = existing?.id ?? crypto.randomUUID();

				const order: EtsyOrder = {
					id,
					etsyReceiptId,
					status:
						receipt.status === "canceled"
							? "cancelled"
							: receipt.is_shipped
								? "shipped"
								: receipt.status === "completed"
									? "completed"
									: receipt.status === "paid"
										? "paid"
										: "open",
					items: receipt.transactions.map((t) => ({
						transactionId: t.transaction_id,
						listingId: t.listing_id,
						title: t.title,
						quantity: t.quantity,
						price: etsyMoney(t.price),
					})),
					subtotal: etsyMoney(receipt.subtotal),
					shippingCost: etsyMoney(receipt.total_shipping_cost),
					etsyFee: 0,
					processingFee: 0,
					tax: etsyMoney(receipt.total_tax_cost),
					total: etsyMoney(receipt.total_price),
					buyerName: receipt.name,
					buyerEmail: receipt.buyer_email ?? undefined,
					shippingAddress: {
						firstLine: receipt.first_line,
						secondLine: receipt.second_line,
						city: receipt.city,
						state: receipt.state,
						zip: receipt.zip,
						country: receipt.country_iso,
					},
					giftMessage: receipt.gift_message || undefined,
					trackingNumber: receipt.shipping_tracking_code ?? undefined,
					carrier: receipt.shipping_carrier ?? undefined,
					shipDate: receipt.shipped_date
						? new Date(receipt.shipped_date * 1000)
						: undefined,
					createdAt:
						existing?.createdAt ?? new Date(receipt.create_timestamp * 1000),
					updatedAt: now,
				};

				await data.upsert(
					"etsyOrder",
					id,
					order as unknown as Record<string, unknown>,
				);
				synced++;
			}

			return { synced };
		},

		async syncReviews() {
			if (!provider) return { synced: 0 };

			const response = await provider.getReviews({ limit: 25 });
			let synced = 0;

			for (const apiReview of response.results) {
				const etsyTransactionId = String(apiReview.transaction_id);

				// Check if we already have this review
				const matches = await data.findMany("etsyReview", {
					where: { etsyTransactionId },
					take: 1,
				});

				const existing = matches[0] as unknown as EtsyReview | undefined;
				const id = existing?.id ?? crypto.randomUUID();

				const review: EtsyReview = {
					id,
					etsyTransactionId,
					rating: apiReview.rating,
					review: apiReview.review ?? undefined,
					listingId: apiReview.listing_id
						? String(apiReview.listing_id)
						: undefined,
					createdAt:
						existing?.createdAt ?? new Date(apiReview.create_timestamp * 1000),
				};

				await data.upsert(
					"etsyReview",
					id,
					review as unknown as Record<string, unknown>,
				);
				synced++;
			}

			return { synced };
		},
	};
}
