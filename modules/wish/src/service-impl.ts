import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { WishProvider } from "./provider";
import type {
	ChannelStats,
	WishController,
	WishOrder,
	WishProduct,
} from "./service";

export function createWishController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: { accessToken?: string | undefined },
): WishController {
	const provider = options?.accessToken
		? new WishProvider({ accessToken: options.accessToken })
		: null;

	return {
		async createProduct(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const product: WishProduct = {
				id,
				localProductId: params.localProductId,
				wishProductId: undefined,
				title: params.title,
				status: "active",
				price: params.price,
				shippingPrice: params.shippingPrice,
				quantity: params.quantity ?? 0,
				parentSku: params.parentSku,
				tags: params.tags ?? [],
				lastSyncedAt: undefined,
				reviewStatus: undefined,
				error: undefined,
				createdAt: now,
				updatedAt: now,
			};

			if (provider) {
				try {
					const wishProduct = await provider.createProduct({
						parentSku: params.parentSku,
						name: params.title,
						basePrice: params.price,
						shipping: params.shippingPrice,
						inventory: params.quantity,
						tags: params.tags,
					});
					product.wishProductId = wishProduct.id;
					product.lastSyncedAt = now;
					events?.emit("wish.product.synced", {
						localId: id,
						wishProductId: wishProduct.id,
					});
				} catch (err) {
					product.error = err instanceof Error ? err.message : String(err);
				}
			}

			await data.upsert("wishProduct", id, product as Record<string, unknown>);
			return product;
		},

		async updateProduct(id, params) {
			const existing = await data.get("wishProduct", id);
			if (!existing) return null;

			const product = existing as unknown as WishProduct;
			const now = new Date();

			const updated: WishProduct = {
				...product,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.shippingPrice !== undefined
					? { shippingPrice: params.shippingPrice }
					: {}),
				...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
				...(params.parentSku !== undefined
					? { parentSku: params.parentSku }
					: {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.wishProductId !== undefined
					? { wishProductId: params.wishProductId }
					: {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.reviewStatus !== undefined
					? { reviewStatus: params.reviewStatus }
					: {}),
				updatedAt: now,
			};

			if (provider && updated.wishProductId) {
				try {
					await provider.updateProduct(updated.wishProductId, {
						...(params.title !== undefined ? { name: params.title } : {}),
						...(params.price !== undefined ? { basePrice: params.price } : {}),
						...(params.shippingPrice !== undefined
							? { shipping: params.shippingPrice }
							: {}),
						...(params.quantity !== undefined
							? { inventory: params.quantity }
							: {}),
						...(params.tags !== undefined ? { tags: params.tags } : {}),
					});
					updated.lastSyncedAt = now;
					updated.error = undefined;
					events?.emit("wish.product.synced", {
						localId: id,
						wishProductId: updated.wishProductId,
					});
				} catch (err) {
					updated.error = err instanceof Error ? err.message : String(err);
				}
			}

			await data.upsert("wishProduct", id, updated as Record<string, unknown>);
			return updated;
		},

		async disableProduct(id) {
			const existing = await data.get("wishProduct", id);
			if (!existing) return null;

			const product = existing as unknown as WishProduct;
			const now = new Date();

			const updated: WishProduct = {
				...product,
				status: "disabled",
				updatedAt: now,
			};

			if (provider && product.wishProductId) {
				try {
					await provider.disableProduct(product.wishProductId);
					updated.lastSyncedAt = now;
					updated.error = undefined;
					events?.emit("wish.product.disabled", {
						localId: id,
						wishProductId: product.wishProductId,
					});
				} catch (err) {
					updated.error = err instanceof Error ? err.message : String(err);
				}
			}

			await data.upsert("wishProduct", id, updated as Record<string, unknown>);
			return updated;
		},

		async getProduct(id) {
			const raw = await data.get("wishProduct", id);
			if (!raw) return null;
			return raw as unknown as WishProduct;
		},

		async getProductByLocalId(productId) {
			const matches = await data.findMany("wishProduct", {
				where: { localProductId: productId },
				take: 1,
			});
			return matches[0] as unknown as WishProduct;
		},

		async listProducts(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("wishProduct", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as WishProduct[];
		},

		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();

			const order: WishOrder = {
				id,
				wishOrderId: params.wishOrderId,
				status: "pending",
				items: params.items,
				orderTotal: params.orderTotal,
				shippingTotal: params.shippingTotal,
				wishFee: params.wishFee,
				customerName: params.customerName,
				shippingAddress: params.shippingAddress ?? {},
				trackingNumber: undefined,
				carrier: undefined,
				shipByDate: params.shipByDate,
				deliverByDate: params.deliverByDate,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("wishOrder", id, order as Record<string, unknown>);
			events?.emit("wish.order.received", {
				orderId: id,
				wishOrderId: params.wishOrderId,
			});
			return order;
		},

		async getOrder(id) {
			const raw = await data.get("wishOrder", id);
			if (!raw) return null;
			return raw as unknown as WishOrder;
		},

		async shipOrder(id, trackingNumber, carrier) {
			const existing = await data.get("wishOrder", id);
			if (!existing) return null;

			const order = existing as unknown as WishOrder;
			const now = new Date();

			const updated: WishOrder = {
				...order,
				status: "shipped",
				trackingNumber,
				carrier,
				updatedAt: now,
			};

			if (provider) {
				try {
					await provider.shipOrder({
						orderId: order.wishOrderId,
						trackingNumber,
						carrier,
					});
					events?.emit("wish.order.shipped", {
						orderId: id,
						wishOrderId: order.wishOrderId,
						trackingNumber,
					});
				} catch (err) {
					// Store locally even if Wish API call fails — operator can retry
					console.error(
						`Wish ship order API error for ${order.wishOrderId}:`,
						err,
					);
				}
			}

			await data.upsert("wishOrder", id, updated as Record<string, unknown>);
			return updated;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("wishOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return all as unknown as WishOrder[];
		},

		async getChannelStats() {
			const allProducts = await data.findMany("wishProduct", {});
			const products = allProducts as unknown as WishProduct[];
			const allOrders = await data.findMany("wishOrder", {});
			const orders = allOrders as unknown as WishOrder[];

			const stats: ChannelStats = {
				totalProducts: products.length,
				activeProducts: products.filter((p) => p.status === "active").length,
				totalOrders: orders.length,
				totalRevenue: orders.reduce((sum, o) => sum + o.orderTotal, 0),
				pendingShipments: orders.filter(
					(o) => o.status === "pending" || o.status === "approved",
				).length,
				disabledProducts: products.filter((p) => p.status === "disabled")
					.length,
			};

			return stats;
		},

		async getPendingShipments() {
			const pending = await data.findMany("wishOrder", {
				where: { status: "approved" },
				orderBy: { createdAt: "asc" },
			});
			return pending as unknown as WishOrder[];
		},
	};
}
