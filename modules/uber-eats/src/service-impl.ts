import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { UberEatsProvider } from "./provider";
import type {
	MenuSync,
	OrderStats,
	UberEatsController,
	UberEatsEntities,
	UberOrder,
	UberOrderStatus,
} from "./service";

export function createUberEatsController(
	data: ModuleDataService<UberEatsEntities>,
	events?: ScopedEventEmitter | undefined,
	provider?: UberEatsProvider | undefined,
): UberEatsController {
	return {
		async receiveOrder(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const order: UberOrder = {
				id,
				externalOrderId: params.externalOrderId,
				status: "pending",
				items: params.items,
				subtotal: params.subtotal,
				deliveryFee: params.deliveryFee,
				tax: params.tax,
				total: params.total,
				customerName: params.customerName,
				customerPhone: params.customerPhone,
				specialInstructions: params.specialInstructions,
				orderType: params.orderType,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("uberOrder", id, order);
			void events?.emit("ubereats.order.received", {
				orderId: order.id,
				externalOrderId: order.externalOrderId,
				total: order.total,
			});
			return order;
		},

		async acceptOrder(id) {
			const existing = await data.get("uberOrder", id);
			if (!existing) return null;

			const order = existing;
			if (order.status !== "pending") return null;

			// Call Uber Eats API to accept the order
			if (provider && order.externalOrderId) {
				try {
					await provider.acceptOrder(order.externalOrderId);
				} catch (err) {
					const message =
						err instanceof Error
							? err.message
							: "Failed to accept on Uber Eats";
					throw new Error(`Uber Eats accept failed: ${message}`);
				}
			}

			const now = new Date();
			const updated: UberOrder = {
				...order,
				status: "accepted",
				updatedAt: now,
			};
			await data.upsert("uberOrder", id, updated);
			void events?.emit("ubereats.order.accepted", {
				orderId: updated.id,
				externalOrderId: updated.externalOrderId,
			});
			return updated;
		},

		async markReady(id) {
			const existing = await data.get("uberOrder", id);
			if (!existing) return null;

			const order = existing;
			if (order.status !== "accepted" && order.status !== "preparing") {
				return null;
			}

			const now = new Date();
			const updated: UberOrder = {
				...order,
				status: "ready",
				updatedAt: now,
			};
			await data.upsert("uberOrder", id, updated);
			void events?.emit("ubereats.order.ready", {
				orderId: updated.id,
				externalOrderId: updated.externalOrderId,
			});
			return updated;
		},

		async cancelOrder(id, reason) {
			const existing = await data.get("uberOrder", id);
			if (!existing) return null;

			const order = existing;
			if (
				order.status === "delivered" ||
				order.status === "cancelled" ||
				order.status === "picked-up"
			) {
				return null;
			}

			// Call Uber Eats API to cancel the order
			if (provider && order.externalOrderId) {
				try {
					await provider.cancelOrder(
						order.externalOrderId,
						reason ?? "Cancelled by merchant",
						"OTHER",
					);
				} catch (err) {
					const message =
						err instanceof Error
							? err.message
							: "Failed to cancel on Uber Eats";
					throw new Error(`Uber Eats cancel failed: ${message}`);
				}
			}

			const now = new Date();
			const updated: UberOrder = {
				...order,
				status: "cancelled",
				updatedAt: now,
			};
			await data.upsert("uberOrder", id, updated);
			void events?.emit("ubereats.order.cancelled", {
				orderId: updated.id,
				externalOrderId: updated.externalOrderId,
			});
			return updated;
		},

		async getOrder(id) {
			const raw = await data.get("uberOrder", id);
			if (!raw) return null;
			return raw;
		},

		async listOrders(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("uberOrder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all;
		},

		async syncMenu(itemCount) {
			const now = new Date();
			const id = crypto.randomUUID();
			const sync: MenuSync = {
				id,
				status: "syncing",
				itemCount,
				startedAt: now,
				createdAt: now,
			};

			await data.upsert("menuSync", id, sync);

			if (provider) {
				try {
					const menu = await provider.getMenu();
					const totalItems = menu.items.length;
					const completed: MenuSync = {
						...sync,
						status: "synced",
						itemCount: totalItems || itemCount,
						completedAt: new Date(),
					};
					await data.upsert("menuSync", id, completed);
					void events?.emit("ubereats.menu.synced", {
						menuSyncId: completed.id,
						itemCount: completed.itemCount,
					});
					return completed;
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "Menu sync failed";
					const failed: MenuSync = {
						...sync,
						status: "failed",
						error: message,
						completedAt: new Date(),
					};
					await data.upsert("menuSync", id, failed);
					return failed;
				}
			}

			// No provider — mark as synced locally
			const completed: MenuSync = {
				...sync,
				status: "synced",
				completedAt: now,
			};
			await data.upsert("menuSync", id, completed);
			void events?.emit("ubereats.menu.synced", {
				menuSyncId: completed.id,
				itemCount,
			});
			return completed;
		},

		async getLastMenuSync() {
			const all = await data.findMany("menuSync", {});
			const syncs = all;
			if (syncs.length === 0) return null;

			let latest: MenuSync | null = null;
			for (const s of syncs) {
				if (!latest || s.createdAt > latest.createdAt) {
					latest = s;
				}
			}
			return latest;
		},

		async listMenuSyncs(params) {
			const all = await data.findMany("menuSync", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all;
		},

		async getOrderStats() {
			const all = await data.findMany("uberOrder", {});
			const orders = all;

			const stats: OrderStats = {
				total: orders.length,
				pending: 0,
				accepted: 0,
				preparing: 0,
				ready: 0,
				delivered: 0,
				cancelled: 0,
				totalRevenue: 0,
			};

			for (const o of orders) {
				const s = o.status as UberOrderStatus;
				if (s === "pending") stats.pending++;
				else if (s === "accepted") stats.accepted++;
				else if (s === "preparing") stats.preparing++;
				else if (s === "ready") stats.ready++;
				else if (s === "delivered") stats.delivered++;
				else if (s === "cancelled") stats.cancelled++;

				if (s !== "cancelled") {
					stats.totalRevenue += o.total;
				}
			}

			return stats;
		},
	};
}
