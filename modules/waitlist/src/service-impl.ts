import type { ModuleDataService } from "@86d-app/core/types/module";
import type { WaitlistController, WaitlistEntry } from "./service";

export function createWaitlistController(
	data: ModuleDataService,
): WaitlistController {
	return {
		async subscribe(params) {
			const existing = await data.findMany("waitlistEntry", {
				where: { email: params.email, productId: params.productId },
				take: 1,
			});
			const found = existing as unknown as WaitlistEntry[];
			if (found.length > 0 && found[0].status === "waiting") {
				return found[0];
			}

			const id = crypto.randomUUID();
			const entry: WaitlistEntry = {
				id,
				productId: params.productId,
				productName: params.productName,
				variantId: params.variantId,
				variantLabel: params.variantLabel,
				email: params.email,
				customerId: params.customerId,
				status: "waiting",
				createdAt: new Date(),
			};
			await data.upsert("waitlistEntry", id, entry as Record<string, unknown>);
			return entry;
		},

		async unsubscribe(id) {
			const existing = await data.get("waitlistEntry", id);
			if (!existing) return false;
			await data.delete("waitlistEntry", id);
			return true;
		},

		async cancelByEmail(email, productId) {
			const items = await data.findMany("waitlistEntry", {
				where: { email, productId, status: "waiting" },
			});
			const found = items as unknown as WaitlistEntry[];
			if (found.length === 0) return false;
			for (const item of found) {
				const record: Record<string, unknown> = {
					...item,
					status: "cancelled",
				};
				await data.upsert("waitlistEntry", item.id, record);
			}
			return true;
		},

		async getEntry(id) {
			const raw = await data.get("waitlistEntry", id);
			if (!raw) return null;
			return raw as unknown as WaitlistEntry;
		},

		async isSubscribed(email, productId) {
			const items = await data.findMany("waitlistEntry", {
				where: { email, productId, status: "waiting" },
				take: 1,
			});
			return (items as unknown as WaitlistEntry[]).length > 0;
		},

		async listByProduct(productId, params) {
			const where: Record<string, unknown> = { productId };
			if (params?.status) where.status = params.status;

			const all = await data.findMany("waitlistEntry", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as WaitlistEntry[];
		},

		async listByEmail(email, params) {
			const all = await data.findMany("waitlistEntry", {
				where: { email },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as WaitlistEntry[];
		},

		async listAll(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.email) where.email = params.email;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("waitlistEntry", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as WaitlistEntry[];
		},

		async countByProduct(productId) {
			const all = await data.findMany("waitlistEntry", {
				where: { productId, status: "waiting" },
			});
			return (all as unknown as WaitlistEntry[]).length;
		},

		async markNotified(productId) {
			const waiting = await data.findMany("waitlistEntry", {
				where: { productId, status: "waiting" },
			});
			const entries = waiting as unknown as WaitlistEntry[];
			const now = new Date();
			for (const entry of entries) {
				const record: Record<string, unknown> = {
					...entry,
					status: "notified",
					notifiedAt: now,
				};
				await data.upsert("waitlistEntry", entry.id, record);
			}
			return entries.length;
		},

		async markPurchased(email, productId) {
			const items = await data.findMany("waitlistEntry", {
				where: { email, productId },
			});
			const found = items as unknown as WaitlistEntry[];
			const active = found.filter(
				(e) => e.status === "waiting" || e.status === "notified",
			);
			if (active.length === 0) return false;
			for (const entry of active) {
				const record: Record<string, unknown> = {
					...entry,
					status: "purchased",
				};
				await data.upsert("waitlistEntry", entry.id, record);
			}
			return true;
		},

		async getSummary() {
			const all = await data.findMany("waitlistEntry", {});
			const entries = all as unknown as WaitlistEntry[];

			let totalWaiting = 0;
			let totalNotified = 0;
			const productCounts = new Map<
				string,
				{ productId: string; productName: string; count: number }
			>();

			for (const entry of entries) {
				if (entry.status === "waiting") totalWaiting++;
				if (entry.status === "notified") totalNotified++;

				if (entry.status === "waiting") {
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

			return { totalWaiting, totalNotified, topProducts };
		},
	};
}
