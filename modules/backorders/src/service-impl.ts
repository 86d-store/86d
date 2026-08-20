import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Backorder,
	BackorderPolicy,
	BackorderStatus,
	BackordersController,
} from "./service";

const ACTIVE_STATUSES: BackorderStatus[] = [
	"pending",
	"confirmed",
	"allocated",
];

export function createBackordersController(
	data: ModuleDataService,
): BackordersController {
	async function findBackorder(id: string): Promise<Backorder | null> {
		const raw = await data.get("backorder", id);
		if (!raw) return null;
		return raw as unknown as Backorder;
	}

	async function saveBackorder(bo: Backorder): Promise<void> {
		await data.upsert("backorder", bo.id, bo as Record<string, unknown>);
	}

	async function findPolicy(
		productId: string,
	): Promise<BackorderPolicy | null> {
		const items = await data.findMany("backorderPolicy", {
			where: { productId },
			take: 1,
		});
		const found = items as unknown as BackorderPolicy[];
		return found.length > 0 ? found[0] : null;
	}

	return {
		async createBackorder(params) {
			const policy = await findPolicy(params.productId);
			if (policy && !policy.enabled) return null;

			if (
				policy?.maxQuantityPerOrder &&
				params.quantity > policy.maxQuantityPerOrder
			) {
				return null;
			}

			if (policy?.maxTotalBackorders) {
				const existing = await data.findMany("backorder", {
					where: { productId: params.productId },
				});
				const active = (existing as unknown as Backorder[]).filter((b) =>
					ACTIVE_STATUSES.includes(b.status),
				);
				const totalQty = active.reduce((sum, b) => sum + b.quantity, 0);
				if (totalQty + params.quantity > policy.maxTotalBackorders) {
					return null;
				}
			}

			const now = new Date();
			const id = crypto.randomUUID();
			const status: BackorderStatus = policy?.autoConfirm
				? "confirmed"
				: "pending";

			let estimatedAvailableAt = params.estimatedAvailableAt;
			if (!estimatedAvailableAt && policy?.estimatedLeadDays) {
				estimatedAvailableAt = new Date(
					now.getTime() + policy.estimatedLeadDays * 86400000,
				);
			}

			const backorder: Backorder = {
				id,
				productId: params.productId,
				productName: params.productName,
				variantId: params.variantId,
				variantLabel: params.variantLabel,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				orderId: params.orderId,
				quantity: params.quantity,
				status,
				estimatedAvailableAt,
				notes: params.notes,
				createdAt: now,
				updatedAt: now,
			};

			await saveBackorder(backorder);
			return backorder;
		},

		async getBackorder(id) {
			return findBackorder(id);
		},

		async listBackorders(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("backorder", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Backorder[];
		},

		async countByProduct(productId) {
			const items = await data.findMany("backorder", {
				where: { productId },
			});
			return (items as unknown as Backorder[]).filter((b) =>
				ACTIVE_STATUSES.includes(b.status),
			).length;
		},

		async updateStatus(id, status, reason) {
			const bo = await findBackorder(id);
			if (!bo) return null;

			const now = new Date();
			const updated: Backorder = { ...bo, status, updatedAt: now };

			if (status === "allocated") updated.allocatedAt = now;
			if (status === "shipped") updated.shippedAt = now;
			if (status === "cancelled") {
				updated.cancelledAt = now;
				if (reason) updated.cancelReason = reason;
			}

			await saveBackorder(updated);
			return updated;
		},

		async bulkUpdateStatus(ids, status) {
			let updated = 0;
			const now = new Date();
			for (const id of ids) {
				const bo = await findBackorder(id);
				if (!bo) continue;

				const record: Backorder = { ...bo, status, updatedAt: now };
				if (status === "allocated") record.allocatedAt = now;
				if (status === "shipped") record.shippedAt = now;
				if (status === "cancelled") record.cancelledAt = now;

				await saveBackorder(record);
				updated++;
			}
			return { updated };
		},

		async allocateStock(productId, quantity) {
			const items = await data.findMany("backorder", {
				where: { productId, status: "confirmed" },
			});
			const confirmed = (items as unknown as Backorder[]).sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);

			let remaining = quantity;
			const allocatedIds: string[] = [];
			const now = new Date();

			for (const bo of confirmed) {
				if (remaining <= 0) break;
				if (bo.quantity <= remaining) {
					remaining -= bo.quantity;
					const updated: Backorder = {
						...bo,
						status: "allocated",
						allocatedAt: now,
						updatedAt: now,
					};
					await saveBackorder(updated);
					allocatedIds.push(bo.id);
				}
			}

			return { allocated: allocatedIds.length, backorderIds: allocatedIds };
		},

		async cancelBackorder(id, reason) {
			const bo = await findBackorder(id);
			if (!bo) return null;
			if (bo.status === "cancelled" || bo.status === "delivered") return bo;

			const now = new Date();
			const updated: Backorder = {
				...bo,
				status: "cancelled",
				cancelledAt: now,
				cancelReason: reason,
				updatedAt: now,
			};
			await saveBackorder(updated);
			return updated;
		},

		async getCustomerBackorders(customerId, params) {
			const all = await data.findMany("backorder", {
				where: { customerId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Backorder[];
		},

		async setPolicy(params) {
			const existing = await findPolicy(params.productId);
			const now = new Date();
			const id = existing?.id ?? params.productId;

			const policy: BackorderPolicy = {
				id,
				productId: params.productId,
				enabled: params.enabled,
				maxQuantityPerOrder: params.maxQuantityPerOrder,
				maxTotalBackorders: params.maxTotalBackorders,
				estimatedLeadDays: params.estimatedLeadDays,
				autoConfirm: params.autoConfirm ?? false,
				message: params.message,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			};

			await data.upsert(
				"backorderPolicy",
				id,
				policy as Record<string, unknown>,
			);
			return policy;
		},

		async getPolicy(productId) {
			return findPolicy(productId);
		},

		async listPolicies(params) {
			const where: Record<string, unknown> = {};
			if (params?.enabled !== undefined) where.enabled = params.enabled;

			const all = await data.findMany("backorderPolicy", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as BackorderPolicy[];
		},

		async deletePolicy(productId) {
			const policy = await findPolicy(productId);
			if (!policy) return false;
			await data.delete("backorderPolicy", policy.id);
			return true;
		},

		async checkEligibility(productId, quantity) {
			const policy = await findPolicy(productId);

			if (!policy?.enabled) {
				return { eligible: false, reason: "Backorders not available" };
			}

			if (policy.maxQuantityPerOrder && quantity > policy.maxQuantityPerOrder) {
				return {
					eligible: false,
					reason: `Maximum ${policy.maxQuantityPerOrder} per order`,
				};
			}

			if (policy.maxTotalBackorders) {
				const items = await data.findMany("backorder", {
					where: { productId },
				});
				const active = (items as unknown as Backorder[]).filter((b) =>
					ACTIVE_STATUSES.includes(b.status),
				);
				const totalQty = active.reduce((sum, b) => sum + b.quantity, 0);
				if (totalQty + quantity > policy.maxTotalBackorders) {
					return {
						eligible: false,
						reason: "Backorder capacity reached",
					};
				}
			}

			return {
				eligible: true,
				estimatedLeadDays: policy.estimatedLeadDays,
				message: policy.message,
			};
		},

		async getSummary() {
			const all = await data.findMany("backorder", {});
			const entries = all as unknown as Backorder[];

			let totalPending = 0;
			let totalConfirmed = 0;
			let totalAllocated = 0;
			let totalShipped = 0;
			let totalDelivered = 0;
			let totalCancelled = 0;
			const productCounts = new Map<
				string,
				{ productId: string; productName: string; count: number }
			>();

			for (const entry of entries) {
				switch (entry.status) {
					case "pending":
						totalPending++;
						break;
					case "confirmed":
						totalConfirmed++;
						break;
					case "allocated":
						totalAllocated++;
						break;
					case "shipped":
						totalShipped++;
						break;
					case "delivered":
						totalDelivered++;
						break;
					case "cancelled":
						totalCancelled++;
						break;
				}

				if (ACTIVE_STATUSES.includes(entry.status)) {
					const existing = productCounts.get(entry.productId);
					if (existing) {
						existing.count += 1;
					} else {
						productCounts.set(entry.productId, {
							productId: entry.productId,
							productName: entry.productName,
							count: 1,
						});
					}
				}
			}

			const topProducts = Array.from(productCounts.values())
				.sort((a, b) => b.count - a.count)
				.slice(0, 10);

			return {
				totalPending,
				totalConfirmed,
				totalAllocated,
				totalShipped,
				totalDelivered,
				totalCancelled,
				topProducts,
			};
		},
	};
}
