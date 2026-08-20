import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { GoogleProduct } from "./provider";
import {
	GoogleShoppingProvider,
	mapAvailabilityToGoogle,
	mapProductStatusToInternal,
} from "./provider";
import type {
	ChannelOrder,
	ChannelStats,
	FeedSubmission,
	GoogleShoppingController,
	ProductFeedItem,
} from "./service";

interface GoogleShoppingControllerOptions {
	merchantId?: string | undefined;
	apiKey?: string | undefined;
	targetCountry?: string | undefined;
	contentLanguage?: string | undefined;
}

export function createGoogleShoppingController(
	data: ModuleDataService,
	_events?: ScopedEventEmitter | undefined,
	options?: GoogleShoppingControllerOptions | undefined,
): GoogleShoppingController {
	const provider =
		options?.merchantId && options?.apiKey
			? new GoogleShoppingProvider(options.merchantId, options.apiKey)
			: null;
	const targetCountry = options?.targetCountry ?? "US";
	const contentLanguage = options?.contentLanguage ?? "en";
	return {
		async createFeedItem(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const item: ProductFeedItem = {
				id,
				localProductId: params.localProductId,
				googleProductId: params.googleProductId,
				title: params.title,
				description: params.description,
				status: params.status ?? "pending",
				disapprovalReasons: params.disapprovalReasons ?? [],
				googleCategory: params.googleCategory,
				condition: params.condition ?? "new",
				availability: params.availability ?? "in-stock",
				price: params.price,
				salePrice: params.salePrice,
				link: params.link,
				imageLink: params.imageLink,
				gtin: params.gtin,
				mpn: params.mpn,
				brand: params.brand,
				lastSyncedAt: undefined,
				expiresAt: params.expiresAt,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"productFeed",
				id,
				item as unknown as Record<string, unknown>,
			);
			return item;
		},

		async updateFeedItem(id, params) {
			const existing = await data.get("productFeed", id);
			if (!existing) return null;

			const item = existing as unknown as ProductFeedItem;
			const now = new Date();

			const updated: ProductFeedItem = {
				...item,
				...(params.googleProductId !== undefined
					? { googleProductId: params.googleProductId }
					: {}),
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.disapprovalReasons !== undefined
					? { disapprovalReasons: params.disapprovalReasons }
					: {}),
				...(params.googleCategory !== undefined
					? { googleCategory: params.googleCategory }
					: {}),
				...(params.condition !== undefined
					? { condition: params.condition }
					: {}),
				...(params.availability !== undefined
					? { availability: params.availability }
					: {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.salePrice !== undefined
					? { salePrice: params.salePrice }
					: {}),
				...(params.link !== undefined ? { link: params.link } : {}),
				...(params.imageLink !== undefined
					? { imageLink: params.imageLink }
					: {}),
				...(params.gtin !== undefined ? { gtin: params.gtin } : {}),
				...(params.mpn !== undefined ? { mpn: params.mpn } : {}),
				...(params.brand !== undefined ? { brand: params.brand } : {}),
				...(params.expiresAt !== undefined
					? { expiresAt: params.expiresAt }
					: {}),
				updatedAt: now,
			};

			await data.upsert(
				"productFeed",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteFeedItem(id) {
			const existing = await data.get("productFeed", id);
			if (!existing) return false;
			await data.delete("productFeed", id);
			return true;
		},

		async getFeedItem(id) {
			const raw = await data.get("productFeed", id);
			if (!raw) return null;
			return raw as unknown as ProductFeedItem;
		},

		async getFeedItemByProduct(localProductId) {
			const matches = await data.findMany("productFeed", {
				where: { localProductId },
				take: 1,
			});
			return (matches[0] as unknown as ProductFeedItem) ?? null;
		},

		async listFeedItems(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("productFeed", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as ProductFeedItem[];
		},

		async submitFeed() {
			const now = new Date();
			const id = crypto.randomUUID();

			const allItems = await data.findMany("productFeed", {});
			const items = allItems as unknown as ProductFeedItem[];

			const submission: FeedSubmission = {
				id,
				status: provider ? "processing" : "pending",
				totalProducts: items.length,
				approvedProducts: items.filter((i) => i.status === "active").length,
				disapprovedProducts: items.filter((i) => i.status === "disapproved")
					.length,
				submittedAt: now,
				createdAt: now,
			};

			await data.upsert(
				"feedSubmission",
				id,
				submission as unknown as Record<string, unknown>,
			);

			if (!provider || items.length === 0) return submission;

			let pushed = 0;
			let failed = 0;

			for (const item of items) {
				const googleProduct: GoogleProduct = {
					offerId: item.localProductId,
					title: item.title,
					description: item.description,
					link: item.link,
					imageLink: item.imageLink,
					contentLanguage,
					targetCountry,
					channel: "online",
					availability: mapAvailabilityToGoogle(item.availability),
					condition: item.condition,
					price: { value: String(item.price), currency: "USD" },
					...(item.salePrice !== undefined
						? {
								salePrice: {
									value: String(item.salePrice),
									currency: "USD",
								},
							}
						: {}),
					...(item.gtin ? { gtin: item.gtin } : {}),
					...(item.mpn ? { mpn: item.mpn } : {}),
					...(item.brand ? { brand: item.brand } : {}),
					...(item.googleCategory
						? { googleProductCategory: item.googleCategory }
						: {}),
				};

				try {
					const inserted = await provider.insertProduct(googleProduct);
					const updatedItem: ProductFeedItem = {
						...item,
						googleProductId: inserted.id ?? item.googleProductId,
						status: "active",
						lastSyncedAt: new Date(),
						updatedAt: new Date(),
					};
					await data.upsert(
						"productFeed",
						item.id,
						updatedItem as unknown as Record<string, unknown>,
					);
					pushed++;
				} catch {
					failed++;
				}
			}

			let approvedProducts = 0;
			let disapprovedProducts = 0;

			try {
				const statusesResponse = await provider.listProductStatuses();
				const statuses = statusesResponse.resources ?? [];
				for (const status of statuses) {
					const internalStatus = mapProductStatusToInternal(
						status.destinationStatuses,
					);
					if (internalStatus === "active") approvedProducts++;
					else if (internalStatus === "disapproved") disapprovedProducts++;
				}
			} catch {
				approvedProducts = pushed;
			}

			const completed: FeedSubmission = {
				...submission,
				status: failed === items.length ? "failed" : "completed",
				approvedProducts,
				disapprovedProducts,
				completedAt: new Date(),
				...(failed > 0
					? {
							error: `${failed} of ${items.length} products failed to submit`,
						}
					: {}),
			};

			await data.upsert(
				"feedSubmission",
				id,
				completed as unknown as Record<string, unknown>,
			);
			return completed;
		},

		async getLastSubmission() {
			const all = await data.findMany("feedSubmission", {
				orderBy: { createdAt: "desc" },
				take: 1,
			});
			return (all[0] as unknown as FeedSubmission) ?? null;
		},

		async listSubmissions(params) {
			const all = await data.findMany("feedSubmission", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as FeedSubmission[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: ChannelOrder = {
				id,
				googleOrderId: params.googleOrderId,
				status: params.status ?? "pending",
				items: params.items,
				subtotal: params.subtotal,
				shippingCost: params.shippingCost,
				tax: params.tax,
				total: params.total,
				shippingAddress: params.shippingAddress,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"channelOrder",
				id,
				order as unknown as Record<string, unknown>,
			);
			return order;
		},

		async getOrder(id) {
			const raw = await data.get("channelOrder", id);
			if (!raw) return null;
			return raw as unknown as ChannelOrder;
		},

		async updateOrderStatus(id, status, trackingNumber, carrier) {
			const existing = await data.get("channelOrder", id);
			if (!existing) return null;

			const order = existing as unknown as ChannelOrder;
			const now = new Date();

			const updated: ChannelOrder = {
				...order,
				status,
				...(trackingNumber !== undefined ? { trackingNumber } : {}),
				...(carrier !== undefined ? { carrier } : {}),
				updatedAt: now,
			};

			await data.upsert(
				"channelOrder",
				id,
				updated as unknown as Record<string, unknown>,
			);
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
			const allItems = await data.findMany("productFeed", {});
			const items = allItems as unknown as ProductFeedItem[];

			const allOrders = await data.findMany("channelOrder", {});
			const orders = allOrders as unknown as ChannelOrder[];

			const stats: ChannelStats = {
				totalFeedItems: items.length,
				active: items.filter((i) => i.status === "active").length,
				pending: items.filter((i) => i.status === "pending").length,
				disapproved: items.filter((i) => i.status === "disapproved").length,
				expiring: items.filter((i) => i.status === "expiring").length,
				totalOrders: orders.length,
				totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
			};

			return stats;
		},

		async pushProduct(id) {
			const raw = await data.get("productFeed", id);
			if (!raw) return null;
			if (!provider) return null;

			const item = raw as unknown as ProductFeedItem;

			const googleProduct: GoogleProduct = {
				offerId: item.localProductId,
				title: item.title,
				description: item.description,
				link: item.link,
				imageLink: item.imageLink,
				contentLanguage,
				targetCountry,
				channel: "online",
				availability: mapAvailabilityToGoogle(item.availability),
				condition: item.condition,
				price: { value: String(item.price), currency: "USD" },
				...(item.salePrice !== undefined
					? {
							salePrice: {
								value: String(item.salePrice),
								currency: "USD",
							},
						}
					: {}),
				...(item.gtin ? { gtin: item.gtin } : {}),
				...(item.mpn ? { mpn: item.mpn } : {}),
				...(item.brand ? { brand: item.brand } : {}),
				...(item.googleCategory
					? { googleProductCategory: item.googleCategory }
					: {}),
			};

			const inserted = await provider.insertProduct(googleProduct);
			const now = new Date();

			const updated: ProductFeedItem = {
				...item,
				googleProductId: inserted.id ?? item.googleProductId,
				status: "active",
				lastSyncedAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"productFeed",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async syncProducts() {
			if (!provider) return { synced: 0 };

			const statusesResponse = await provider.listProductStatuses();
			const statuses = statusesResponse.resources ?? [];
			let synced = 0;

			for (const status of statuses) {
				const allItems = await data.findMany("productFeed", {
					where: { googleProductId: status.productId },
					take: 1,
				});
				const existing = allItems[0] as unknown as ProductFeedItem | undefined;
				if (!existing) continue;

				const newStatus = mapProductStatusToInternal(
					status.destinationStatuses,
				);
				const issues = status.itemLevelIssues
					.filter((i) => i.servability === "disapproved")
					.map((i) => i.description ?? i.code);
				const now = new Date();

				const updated: ProductFeedItem = {
					...existing,
					status: newStatus,
					disapprovalReasons:
						issues.length > 0 ? issues : existing.disapprovalReasons,
					lastSyncedAt: now,
					updatedAt: now,
				};

				await data.upsert(
					"productFeed",
					existing.id,
					updated as unknown as Record<string, unknown>,
				);
				synced++;
			}

			return { synced };
		},

		async getDiagnostics() {
			const allItems = await data.findMany("productFeed", {});
			const items = allItems as unknown as ProductFeedItem[];

			const statusMap = new Map<string, number>();
			const reasonMap = new Map<string, number>();

			for (const item of items) {
				statusMap.set(item.status, (statusMap.get(item.status) ?? 0) + 1);
				for (const reason of item.disapprovalReasons ?? []) {
					reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
				}
			}

			return {
				statusBreakdown: [...statusMap.entries()]
					.map(([status, count]) => ({ status, count }))
					.sort((a, b) => b.count - a.count),
				disapprovalReasons: [...reasonMap.entries()]
					.map(([reason, count]) => ({ reason, count }))
					.sort((a, b) => b.count - a.count),
			};
		},
	};
}
