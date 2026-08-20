import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	formatPinterestPrice,
	mapAvailabilityToPinterest,
	PinterestApiProvider,
} from "./provider";
import type {
	CatalogItem,
	CatalogSync,
	ChannelStats,
	PinAnalytics,
	PinterestShopController,
	ShoppingPin,
} from "./service";

export function createPinterestShopController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		accessToken: string;
		adAccountId?: string | undefined;
		catalogId?: string | undefined;
	},
): PinterestShopController {
	const provider = options?.accessToken
		? new PinterestApiProvider({
				accessToken: options.accessToken,
				adAccountId: options.adAccountId,
				catalogId: options.catalogId,
			})
		: null;

	return {
		async createCatalogItem(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const item: CatalogItem = {
				id,
				localProductId: params.localProductId,
				pinterestItemId: undefined,
				title: params.title,
				description: params.description,
				status: "active",
				link: params.link,
				imageUrl: params.imageUrl,
				price: params.price,
				salePrice: params.salePrice,
				availability: params.availability ?? "in-stock",
				googleCategory: params.googleCategory,
				lastSyncedAt: undefined,
				error: undefined,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("catalogItem", id, item as Record<string, unknown>);
			return item;
		},

		async updateCatalogItem(id, params) {
			const existing = await data.get("catalogItem", id);
			if (!existing) return null;

			const item = existing as unknown as CatalogItem;
			const now = new Date();

			const updated: CatalogItem = {
				...item,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.link !== undefined ? { link: params.link } : {}),
				...(params.imageUrl !== undefined ? { imageUrl: params.imageUrl } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.salePrice !== undefined
					? { salePrice: params.salePrice }
					: {}),
				...(params.availability !== undefined
					? { availability: params.availability }
					: {}),
				...(params.googleCategory !== undefined
					? { googleCategory: params.googleCategory }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.pinterestItemId !== undefined
					? { pinterestItemId: params.pinterestItemId }
					: {}),
				updatedAt: now,
			};

			await data.upsert("catalogItem", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteCatalogItem(id) {
			const existing = await data.get("catalogItem", id);
			if (!existing) return false;

			const item = existing as unknown as CatalogItem;

			if (provider && item.pinterestItemId) {
				try {
					await provider.batchDeleteItems([item.pinterestItemId]);
				} catch {
					// Continue with local deletion even if API call fails
				}
			}

			await data.delete("catalogItem", id);
			return true;
		},

		async getCatalogItem(id) {
			const raw = await data.get("catalogItem", id);
			if (!raw) return null;
			return raw as unknown as CatalogItem;
		},

		async getCatalogItemByProduct(productId) {
			const matches = await data.findMany("catalogItem", {
				where: { localProductId: productId },
				take: 1,
			});
			return (matches[0] as unknown as CatalogItem) ?? null;
		},

		async listCatalogItems(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.availability) where.availability = params.availability;

			const all = await data.findMany("catalogItem", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as CatalogItem[];
		},

		async syncCatalog() {
			const now = new Date();
			const id = crypto.randomUUID();

			const allItems = await data.findMany("catalogItem", {
				where: { status: "active" },
			});
			const items = allItems as unknown as CatalogItem[];

			const sync: CatalogSync = {
				id,
				status: "syncing",
				totalItems: items.length,
				syncedItems: 0,
				failedItems: 0,
				error: undefined,
				startedAt: now,
				completedAt: undefined,
				createdAt: now,
			};

			if (!provider) {
				sync.status = "synced";
				sync.syncedItems = items.length;
				sync.completedAt = new Date();

				await data.upsert("catalogSync", id, sync as Record<string, unknown>);
				return sync;
			}

			await data.upsert("catalogSync", id, sync as Record<string, unknown>);

			try {
				const batchItems = items.map((item) => ({
					itemId: item.pinterestItemId ?? item.localProductId,
					title: item.title,
					description: item.description ?? "",
					link: item.link,
					imageLink: item.imageUrl,
					price: formatPinterestPrice(item.price),
					...(item.salePrice
						? { salePrice: formatPinterestPrice(item.salePrice) }
						: {}),
					availability: mapAvailabilityToPinterest(item.availability),
					...(item.googleCategory
						? { googleProductCategory: item.googleCategory }
						: {}),
				}));

				const result = await provider.batchUpsertItems(batchItems);

				const syncedNow = new Date();
				for (const item of items) {
					const updatedItem: CatalogItem = {
						...item,
						pinterestItemId: item.pinterestItemId ?? item.localProductId,
						lastSyncedAt: syncedNow,
						error: undefined,
						updatedAt: syncedNow,
					};
					await data.upsert(
						"catalogItem",
						item.id,
						updatedItem as Record<string, unknown>,
					);
				}

				sync.syncedItems = result.total_count ?? items.length;
				sync.failedItems = result.failure_count ?? 0;
				sync.status = sync.failedItems > 0 ? "failed" : "synced";
				sync.completedAt = new Date();
			} catch (err) {
				sync.status = "failed";
				sync.error = err instanceof Error ? err.message : "Sync failed";
				sync.completedAt = new Date();
			}

			await data.upsert("catalogSync", id, sync as Record<string, unknown>);

			events?.emit("pinterest.catalog.synced", {
				syncId: sync.id,
				totalItems: sync.totalItems,
				syncedItems: sync.syncedItems,
				failedItems: sync.failedItems,
				status: sync.status,
			});

			return sync;
		},

		async getLastSync() {
			const all = await data.findMany("catalogSync", {
				orderBy: { createdAt: "desc" },
				take: 1,
			});
			return (all[0] as unknown as CatalogSync) ?? null;
		},

		async listSyncs(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("catalogSync", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as CatalogSync[];
		},

		async createPin(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			let externalPinId: string | undefined;

			if (provider) {
				try {
					const result = await provider.createPin({
						title: params.title,
						description: params.description,
						link: params.link,
						board_id: params.boardId,
						media_source: {
							source_type: "image_url",
							url: params.imageUrl,
						},
					});
					externalPinId = result.id;
				} catch {
					// Store locally even if Pinterest API call fails
				}
			}

			const pin: ShoppingPin = {
				id,
				catalogItemId: params.catalogItemId,
				pinId: externalPinId,
				boardId: params.boardId,
				title: params.title,
				description: params.description,
				link: params.link,
				imageUrl: params.imageUrl,
				impressions: 0,
				saves: 0,
				clicks: 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("shoppingPin", id, pin as Record<string, unknown>);

			events?.emit("pinterest.pin.created", {
				pinId: pin.id,
				externalPinId,
				catalogItemId: params.catalogItemId,
			});

			return pin;
		},

		async getPin(id) {
			const raw = await data.get("shoppingPin", id);
			if (!raw) return null;
			return raw as unknown as ShoppingPin;
		},

		async listPins(params) {
			const where: Record<string, unknown> = {};
			if (params?.catalogItemId) where.catalogItemId = params.catalogItemId;

			const all = await data.findMany("shoppingPin", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as ShoppingPin[];
		},

		async getPinAnalytics(id) {
			const raw = await data.get("shoppingPin", id);
			if (!raw) return null;

			const pin = raw as unknown as ShoppingPin;

			if (provider && pin.pinId) {
				try {
					const now = new Date();
					const thirtyDaysAgo = new Date(
						now.getTime() - 30 * 24 * 60 * 60 * 1000,
					);
					const startDate = thirtyDaysAgo.toISOString().split("T")[0];
					const endDate = now.toISOString().split("T")[0];

					const result = await provider.getPinAnalytics(
						pin.pinId,
						startDate,
						endDate,
					);

					const metrics = result.all?.lifetime_metrics ?? {};
					const impressions = metrics.IMPRESSION ?? 0;
					const saves = metrics.SAVE ?? 0;
					const clicks = metrics.PIN_CLICK ?? 0;

					const updatedPin: ShoppingPin = {
						...pin,
						impressions,
						saves,
						clicks,
						updatedAt: new Date(),
					};
					await data.upsert(
						"shoppingPin",
						id,
						updatedPin as Record<string, unknown>,
					);

					return {
						impressions,
						saves,
						clicks,
						clickRate: impressions > 0 ? clicks / impressions : 0,
						saveRate: impressions > 0 ? saves / impressions : 0,
					};
				} catch {
					// Fall through to local data
				}
			}

			const analytics: PinAnalytics = {
				impressions: pin.impressions,
				saves: pin.saves,
				clicks: pin.clicks,
				clickRate: pin.impressions > 0 ? pin.clicks / pin.impressions : 0,
				saveRate: pin.impressions > 0 ? pin.saves / pin.impressions : 0,
			};
			return analytics;
		},

		async getChannelStats() {
			const allItems = await data.findMany("catalogItem", {});
			const items = allItems as unknown as CatalogItem[];
			const allPins = await data.findMany("shoppingPin", {});
			const pins = allPins as unknown as ShoppingPin[];

			const stats: ChannelStats = {
				totalCatalogItems: items.length,
				activeCatalogItems: items.filter((i) => i.status === "active").length,
				totalPins: pins.length,
				totalImpressions: pins.reduce((sum, p) => sum + p.impressions, 0),
				totalClicks: pins.reduce((sum, p) => sum + p.clicks, 0),
				totalSaves: pins.reduce((sum, p) => sum + p.saves, 0),
			};

			return stats;
		},
	};
}
