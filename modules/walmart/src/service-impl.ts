import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import {
	extractOrderTotals,
	mapOrderStatus,
	WalmartProvider,
	type WalmartProviderConfig,
} from "./provider";
import type {
	ChannelStats,
	FeedSubmission,
	ItemHealth,
	WalmartController,
	WalmartItem,
	WalmartOrder,
} from "./service";

export function createWalmartController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: {
		clientId?: string | undefined;
		clientSecret?: string | undefined;
		channelType?: string | undefined;
	},
): WalmartController {
	const provider =
		options?.clientId && options?.clientSecret
			? new WalmartProvider({
					clientId: options.clientId,
					clientSecret: options.clientSecret,
					channelType: options.channelType,
				} satisfies WalmartProviderConfig)
			: null;

	return {
		async createItem(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const item: WalmartItem = {
				id,
				localProductId: params.localProductId,
				sku: params.sku,
				title: params.title,
				status: "unpublished",
				lifecycleStatus: "active",
				price: params.price,
				quantity: params.quantity ?? 0,
				upc: params.upc,
				gtin: params.gtin,
				brand: params.brand,
				category: params.category,
				fulfillmentType: params.fulfillmentType ?? "seller",
				publishStatus: undefined,
				lastSyncedAt: undefined,
				error: undefined,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			if (provider) {
				try {
					const feedRes = await provider.submitFeed("item", [
						{
							sku: params.sku,
							productName: params.title,
							price: params.price,
							...(params.upc ? { upc: params.upc } : {}),
							...(params.gtin ? { gtin: params.gtin } : {}),
							...(params.brand ? { brand: params.brand } : {}),
							...(params.category ? { category: params.category } : {}),
						},
					]);
					item.metadata = {
						...item.metadata,
						feedId: feedRes.feedId,
					};
					item.lastSyncedAt = now;
				} catch (err) {
					item.status = "system-error";
					item.error = err instanceof Error ? err.message : "Unknown error";
				}
			}

			await data.upsert("item", id, item as Record<string, unknown>);
			events?.emit("walmart.item.synced", { itemId: id });
			return item;
		},

		async updateItem(id, params) {
			const existing = await data.get("item", id);
			if (!existing) return null;

			const item = existing as unknown as WalmartItem;
			const now = new Date();

			const updated: WalmartItem = {
				...item,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
				...(params.upc !== undefined ? { upc: params.upc } : {}),
				...(params.gtin !== undefined ? { gtin: params.gtin } : {}),
				...(params.brand !== undefined ? { brand: params.brand } : {}),
				...(params.category !== undefined ? { category: params.category } : {}),
				...(params.fulfillmentType !== undefined
					? { fulfillmentType: params.fulfillmentType }
					: {}),
				...(params.walmartItemId !== undefined
					? { walmartItemId: params.walmartItemId }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.publishStatus !== undefined
					? { publishStatus: params.publishStatus }
					: {}),
				...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
				updatedAt: now,
			};

			if (provider && params.quantity !== undefined) {
				try {
					await provider.updateInventory(item.sku, params.quantity);
					updated.lastSyncedAt = now;
					updated.error = undefined;
				} catch (err) {
					updated.error = err instanceof Error ? err.message : "Unknown error";
				}
			}

			await data.upsert("item", id, updated as Record<string, unknown>);
			return updated;
		},

		async retireItem(id) {
			const existing = await data.get("item", id);
			if (!existing) return null;

			const item = existing as unknown as WalmartItem;
			const now = new Date();

			if (provider) {
				try {
					await provider.retireItem(item.sku);
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: WalmartItem = {
				...item,
				status: "retired",
				lifecycleStatus: "archived",
				updatedAt: now,
			};

			await data.upsert("item", id, updated as Record<string, unknown>);
			events?.emit("walmart.item.retired", { itemId: id });
			return updated;
		},

		async getItem(id) {
			const raw = await data.get("item", id);
			if (!raw) return null;
			return raw as unknown as WalmartItem;
		},

		async getItemByProduct(productId) {
			const matches = await data.findMany("item", {
				where: { localProductId: productId },
				take: 1,
			});
			return (matches[0] as unknown as WalmartItem | undefined) ?? null;
		},

		async listItems(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.fulfillmentType)
				where.fulfillmentType = params.fulfillmentType;

			const all = await data.findMany("item", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as WalmartItem[];
		},

		async submitFeed(feedType) {
			const now = new Date();
			const id = crypto.randomUUID();

			const feed: FeedSubmission = {
				id,
				feedId: undefined,
				feedType,
				status: "pending",
				totalItems: 0,
				successItems: 0,
				errorItems: 0,
				error: undefined,
				submittedAt: now,
				completedAt: undefined,
				createdAt: now,
			};

			if (provider) {
				try {
					const allItems = await data.findMany("item", {});
					const items = allItems as unknown as WalmartItem[];
					const feedItems = items.map((item) => ({
						sku: item.sku,
						productName: item.title,
						price: item.price,
						...(item.upc ? { upc: item.upc } : {}),
						...(item.gtin ? { gtin: item.gtin } : {}),
					}));

					const feedRes = await provider.submitFeed(feedType, feedItems);
					feed.feedId = feedRes.feedId;
					feed.totalItems = feedItems.length;
					events?.emit("walmart.feed.submitted", {
						feedId: feedRes.feedId,
						feedType,
					});
				} catch (err) {
					feed.status = "error";
					feed.error = err instanceof Error ? err.message : "Unknown error";
				}
			}

			await data.upsert("feedSubmission", id, feed as Record<string, unknown>);
			return feed;
		},

		async getLastFeed(feedType) {
			const all = await data.findMany("feedSubmission", {
				where: { feedType },
				orderBy: { createdAt: "desc" },
				take: 1,
			});
			return (all[0] as unknown as FeedSubmission | undefined) ?? null;
		},

		async listFeeds(params) {
			const where: Record<string, unknown> = {};
			if (params?.feedType) where.feedType = params.feedType;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("feedSubmission", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as FeedSubmission[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: WalmartOrder = {
				id,
				purchaseOrderId: params.purchaseOrderId,
				status: "created",
				items: params.items,
				orderTotal: params.orderTotal,
				shippingTotal: params.shippingTotal,
				walmartFee: params.walmartFee,
				tax: params.tax,
				customerName: params.customerName,
				shippingAddress: params.shippingAddress ?? {},
				trackingNumber: undefined,
				carrier: undefined,
				shipDate: undefined,
				estimatedDelivery: params.estimatedDelivery,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("walmartOrder", id, order as Record<string, unknown>);
			events?.emit("walmart.order.received", {
				orderId: id,
				purchaseOrderId: params.purchaseOrderId,
			});
			return order;
		},

		async acknowledgeOrder(id) {
			const existing = await data.get("walmartOrder", id);
			if (!existing) return null;

			const order = existing as unknown as WalmartOrder;
			const now = new Date();

			if (provider && order.purchaseOrderId) {
				try {
					await provider.acknowledgeOrder(order.purchaseOrderId);
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: WalmartOrder = {
				...order,
				status: "acknowledged",
				updatedAt: now,
			};

			await data.upsert("walmartOrder", id, updated as Record<string, unknown>);
			return updated;
		},

		async shipOrder(id, trackingNumber, carrier) {
			const existing = await data.get("walmartOrder", id);
			if (!existing) return null;

			const order = existing as unknown as WalmartOrder;
			const now = new Date();

			if (provider && order.purchaseOrderId) {
				try {
					const apiOrder = await provider.getOrder(order.purchaseOrderId);
					const lineNumbers = apiOrder.orderLines.orderLine.map(
						(ol) => ol.lineNumber,
					);
					await provider.shipOrder(order.purchaseOrderId, {
						lineNumbers,
						trackingNumber,
						carrier,
					});
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: WalmartOrder = {
				...order,
				status: "shipped",
				trackingNumber,
				carrier,
				shipDate: now,
				updatedAt: now,
			};

			await data.upsert("walmartOrder", id, updated as Record<string, unknown>);
			events?.emit("walmart.order.shipped", {
				orderId: id,
				trackingNumber,
			});
			return updated;
		},

		async cancelOrder(id) {
			const existing = await data.get("walmartOrder", id);
			if (!existing) return null;

			const order = existing as unknown as WalmartOrder;
			const now = new Date();

			if (provider && order.purchaseOrderId) {
				try {
					const apiOrder = await provider.getOrder(order.purchaseOrderId);
					const lineNumbers = apiOrder.orderLines.orderLine.map(
						(ol) => ol.lineNumber,
					);
					await provider.cancelOrder(order.purchaseOrderId, lineNumbers);
				} catch {
					// Continue with local update even if API call fails
				}
			}

			const updated: WalmartOrder = {
				...order,
				status: "cancelled",
				updatedAt: now,
			};

			await data.upsert("walmartOrder", id, updated as Record<string, unknown>);
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("walmartOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as WalmartOrder[];
		},

		async syncOrders() {
			if (!provider) return [];

			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const synced: WalmartOrder[] = [];

			try {
				const response = await provider.getOrders({
					createdStartDate: thirtyDaysAgo.toISOString(),
					createdEndDate: now.toISOString(),
					limit: 50,
				});

				const apiOrders = response.list.elements.order;

				for (const apiOrder of apiOrders) {
					const existing = await data.findMany("walmartOrder", {
						where: {
							purchaseOrderId: apiOrder.purchaseOrderId,
						},
						take: 1,
					});

					const orderLines = apiOrder.orderLines.orderLine;
					const statuses = orderLines.flatMap((ol) =>
						ol.orderLineStatuses.orderLineStatus.map((s) => s.status),
					);
					const status = mapOrderStatus(statuses);
					const totals = extractOrderTotals(orderLines);

					const items = orderLines.map((ol) => ({
						lineNumber: ol.lineNumber,
						productName: ol.item.productName,
						sku: ol.item.sku,
						quantity: Number(ol.orderLineQuantity.amount),
					}));

					const shippingAddress: Record<string, unknown> = apiOrder.shippingInfo
						.postalAddress
						? {
								name: apiOrder.shippingInfo.postalAddress.name ?? "",
								address1: apiOrder.shippingInfo.postalAddress.address1 ?? "",
								address2: apiOrder.shippingInfo.postalAddress.address2 ?? "",
								city: apiOrder.shippingInfo.postalAddress.city ?? "",
								state: apiOrder.shippingInfo.postalAddress.state ?? "",
								postalCode:
									apiOrder.shippingInfo.postalAddress.postalCode ?? "",
								country: apiOrder.shippingInfo.postalAddress.country ?? "",
							}
						: {};

					const orderData: WalmartOrder = {
						id:
							existing.length > 0
								? (existing[0] as unknown as WalmartOrder).id
								: crypto.randomUUID(),
						purchaseOrderId: apiOrder.purchaseOrderId,
						status,
						items,
						orderTotal: totals.orderTotal,
						shippingTotal: totals.shippingTotal,
						walmartFee: 0,
						tax: totals.tax,
						customerName: apiOrder.shippingInfo.postalAddress?.name,
						shippingAddress,
						trackingNumber: undefined,
						carrier: undefined,
						shipDate: undefined,
						estimatedDelivery: apiOrder.shippingInfo.estimatedDeliveryDate
							? new Date(apiOrder.shippingInfo.estimatedDeliveryDate)
							: undefined,
						createdAt:
							existing.length > 0
								? (existing[0] as unknown as WalmartOrder).createdAt
								: new Date(apiOrder.orderDate),
						updatedAt: now,
					};

					const orderRecord = orderData as Record<string, unknown>;
					await data.upsert("walmartOrder", orderData.id, orderRecord);
					synced.push(orderData);
				}

				events?.emit("walmart.order.received", {
					orderCount: synced.length,
				});
			} catch {
				// Sync failure is non-fatal
			}

			return synced;
		},

		async getChannelStats() {
			const allItems = await data.findMany("item", {});
			const items = allItems as unknown as WalmartItem[];
			const allOrders = await data.findMany("walmartOrder", {});
			const orders = allOrders as unknown as WalmartOrder[];
			const allFeeds = await data.findMany("feedSubmission", {});
			const feeds = allFeeds as unknown as FeedSubmission[];

			const stats: ChannelStats = {
				totalItems: items.length,
				publishedItems: items.filter((i) => i.status === "published").length,
				totalOrders: orders.length,
				totalRevenue: orders.reduce((sum, o) => sum + o.orderTotal, 0),
				pendingFeeds: feeds.filter((f) => f.status === "pending").length,
				errorItems: items.filter((i) => i.status === "system-error").length,
			};

			return stats;
		},

		async getItemHealth() {
			const allItems = await data.findMany("item", {});
			const items = allItems as unknown as WalmartItem[];

			const health: ItemHealth = {
				total: items.length,
				published: 0,
				unpublished: 0,
				retired: 0,
				systemError: 0,
				sellerFulfilled: 0,
				wfsFulfilled: 0,
			};

			for (const item of items) {
				switch (item.status) {
					case "published":
						health.published++;
						break;
					case "unpublished":
						health.unpublished++;
						break;
					case "retired":
						health.retired++;
						break;
					case "system-error":
						health.systemError++;
						break;
				}
				if (item.fulfillmentType === "seller") health.sellerFulfilled++;
				if (item.fulfillmentType === "wfs") health.wfsFulfilled++;
			}

			return health;
		},
	};
}
