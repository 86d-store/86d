import type { ModuleDataService } from "@86d-app/core/types/module";
import type { ReturnController, ReturnItem, ReturnRequest } from "./service";

const TERMINAL_STATUSES = new Set(["completed", "rejected", "cancelled"]);

export function createReturnController(
	data: ModuleDataService,
): ReturnController {
	async function getItems(returnRequestId: string): Promise<ReturnItem[]> {
		const raw = await data.findMany("returnItem", {
			where: { returnRequestId },
		});
		return raw as unknown as ReturnItem[];
	}

	async function updateRequest(
		id: string,
		updates: Record<string, unknown>,
	): Promise<ReturnRequest | null> {
		const existing = await data.get("returnRequest", id);
		if (!existing) return null;

		const updated = {
			...(existing as unknown as ReturnRequest),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("returnRequest", id, updated as Record<string, unknown>);
		return updated;
	}

	return {
		// ── Return request operations ────────────────────────────────

		async create(params) {
			if (params.items.length === 0) {
				throw new Error("Return must include at least one item");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const refundAmount = params.items.reduce(
				(sum, item) => sum + item.unitPrice * item.quantity,
				0,
			);

			const request: ReturnRequest = {
				id,
				orderId: params.orderId,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				status: "requested",
				refundMethod: params.refundMethod ?? "original_payment",
				refundAmount,
				currency: params.currency ?? "USD",
				reason: params.reason,
				customerNotes: params.customerNotes,
				requestedAt: now,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"returnRequest",
				id,
				request as Record<string, unknown>,
			);

			const items: ReturnItem[] = [];
			for (const itemParams of params.items) {
				const itemId = crypto.randomUUID();
				const item: ReturnItem = {
					id: itemId,
					returnRequestId: id,
					orderItemId: itemParams.orderItemId,
					productName: itemParams.productName,
					sku: itemParams.sku,
					productId: itemParams.productId,
					variantId: itemParams.variantId,
					quantity: itemParams.quantity,
					unitPrice: itemParams.unitPrice,
					reason: itemParams.reason,
					condition: itemParams.condition ?? "opened",
					notes: itemParams.notes,
					createdAt: now,
				};
				await data.upsert(
					"returnItem",
					itemId,
					item as Record<string, unknown>,
				);
				items.push(item);
			}

			return { ...request, items };
		},

		async getById(id) {
			const raw = await data.get("returnRequest", id);
			if (!raw) return null;
			const request = raw as unknown as ReturnRequest;
			const items = await getItems(id);
			return { ...request, items };
		},

		async getByOrderId(orderId) {
			const raw = await data.findMany("returnRequest", {
				where: { orderId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as ReturnRequest[];
		},

		async getByCustomerId(customerId, params) {
			const where: Record<string, unknown> = { customerId };
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("returnRequest", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as ReturnRequest[];
		},

		// ── Status transitions ───────────────────────────────────────

		async approve(id, adminNotes) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (req.status !== "requested") {
				throw new Error(`Cannot approve a return with status "${req.status}"`);
			}

			return updateRequest(id, {
				status: "approved",
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async reject(id, adminNotes) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (TERMINAL_STATUSES.has(req.status)) {
				throw new Error(`Cannot reject a return with status "${req.status}"`);
			}

			return updateRequest(id, {
				status: "rejected",
				resolvedAt: new Date(),
				...(adminNotes !== undefined ? { adminNotes } : {}),
			});
		},

		async markReceived(id) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (req.status !== "approved") {
				throw new Error(
					`Cannot mark as received a return with status "${req.status}"`,
				);
			}

			return updateRequest(id, { status: "received" });
		},

		async complete(id, refundAmount) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (req.status !== "approved" && req.status !== "received") {
				throw new Error(`Cannot complete a return with status "${req.status}"`);
			}

			if (refundAmount < 0) {
				throw new Error("Refund amount cannot be negative");
			}

			return updateRequest(id, {
				status: "completed",
				refundAmount,
				resolvedAt: new Date(),
			});
		},

		async cancel(id) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (TERMINAL_STATUSES.has(req.status)) {
				throw new Error(`Cannot cancel a return with status "${req.status}"`);
			}

			return updateRequest(id, {
				status: "cancelled",
				resolvedAt: new Date(),
			});
		},

		// ── Tracking ─────────────────────────────────────────────────

		async updateTracking(id, trackingNumber, carrier) {
			const existing = await data.get("returnRequest", id);
			if (!existing) return null;
			const req = existing as unknown as ReturnRequest;

			if (TERMINAL_STATUSES.has(req.status)) {
				throw new Error(
					`Cannot update tracking for a return with status "${req.status}"`,
				);
			}

			return updateRequest(id, {
				trackingNumber,
				...(carrier !== undefined ? { trackingCarrier: carrier } : {}),
			});
		},

		// ── Admin operations ─────────────────────────────────────────

		async list(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const raw = await data.findMany("returnRequest", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as ReturnRequest[];
		},

		async getSummary() {
			const all = await data.findMany("returnRequest", {});
			const requests = all as unknown as ReturnRequest[];

			let requested = 0;
			let approved = 0;
			let completed = 0;
			let rejected = 0;
			let totalRefundAmount = 0;

			for (const req of requests) {
				switch (req.status) {
					case "requested":
						requested++;
						break;
					case "approved":
					case "received":
						approved++;
						break;
					case "completed":
						completed++;
						totalRefundAmount += req.refundAmount;
						break;
					case "rejected":
						rejected++;
						break;
				}
			}

			return {
				totalRequests: requests.length,
				requested,
				approved,
				completed,
				rejected,
				totalRefundAmount,
			};
		},
	};
}
