import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ActivityEvent,
	ActivityPeriod,
	ProductActivity,
	SocialProofController,
	TrendingProduct,
	TrustBadge,
} from "./service";

function getPeriodDate(period: ActivityPeriod): Date {
	const now = new Date();
	switch (period) {
		case "1h":
			return new Date(now.getTime() - 60 * 60 * 1000);
		case "24h":
			return new Date(now.getTime() - 24 * 60 * 60 * 1000);
		case "7d":
			return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		case "30d":
			return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	}
}

export function createSocialProofController(
	data: ModuleDataService,
): SocialProofController {
	return {
		// --- Activity Events ---

		async recordEvent(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const event: ActivityEvent = {
				id,
				productId: params.productId,
				productName: params.productName,
				productSlug: params.productSlug,
				productImage: params.productImage,
				eventType: params.eventType,
				region: params.region,
				country: params.country,
				city: params.city,
				quantity: params.quantity,
				createdAt: now,
			};

			await data.upsert(
				"activityEvent",
				id,
				event as unknown as Record<string, unknown>,
			);
			return event;
		},

		async getProductActivity(productId, params) {
			const cutoff = getPeriodDate(params?.period ?? "24h");

			const allEvents = (await data.findMany("activityEvent", {
				where: { productId },
			})) as unknown as ActivityEvent[];

			const events = allEvents.filter((e) => new Date(e.createdAt) >= cutoff);

			let viewCount = 0;
			let purchaseCount = 0;
			let cartAddCount = 0;
			let wishlistAddCount = 0;
			const recentPurchases: ProductActivity["recentPurchases"] = [];

			for (const event of events) {
				switch (event.eventType) {
					case "view":
						viewCount++;
						break;
					case "purchase":
						purchaseCount++;
						recentPurchases.push({
							region: event.region,
							city: event.city,
							country: event.country,
							quantity: event.quantity,
							createdAt: event.createdAt,
						});
						break;
					case "cart_add":
						cartAddCount++;
						break;
					case "wishlist_add":
						wishlistAddCount++;
						break;
				}
			}

			recentPurchases.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return {
				productId,
				viewCount,
				purchaseCount,
				cartAddCount,
				wishlistAddCount,
				totalEvents: events.length,
				recentPurchases: recentPurchases.slice(0, 10),
			};
		},

		async getRecentActivity(params) {
			const where: Record<string, unknown> = {};
			if (params?.eventType) {
				where.eventType = params.eventType;
			}

			const events = (await data.findMany("activityEvent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as ActivityEvent[];

			const sorted = events.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const skip = params?.skip ?? 0;
			const take = params?.take ?? 20;
			return sorted.slice(skip, skip + take);
		},

		async getTrendingProducts(params) {
			const cutoff = getPeriodDate(params?.period ?? "24h");

			const allEvents = (await data.findMany(
				"activityEvent",
				{},
			)) as unknown as ActivityEvent[];

			const events = allEvents.filter((e) => new Date(e.createdAt) >= cutoff);

			const productMap = new Map<
				string,
				{
					productId: string;
					productName: string;
					productSlug: string;
					productImage?: string | undefined;
					eventCount: number;
					purchaseCount: number;
				}
			>();

			for (const event of events) {
				const existing = productMap.get(event.productId);
				if (existing) {
					existing.eventCount++;
					if (event.eventType === "purchase") {
						existing.purchaseCount++;
					}
				} else {
					productMap.set(event.productId, {
						productId: event.productId,
						productName: event.productName,
						productSlug: event.productSlug,
						productImage: event.productImage,
						eventCount: 1,
						purchaseCount: event.eventType === "purchase" ? 1 : 0,
					});
				}
			}

			const trending = Array.from(productMap.values()).sort(
				(a, b) => b.eventCount - a.eventCount,
			);

			const skip = params?.skip ?? 0;
			const take = params?.take ?? 10;
			return trending.slice(skip, skip + take);
		},

		// --- Trust Badges ---

		async createBadge(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const badge: TrustBadge = {
				id,
				name: params.name,
				description: params.description,
				icon: params.icon,
				url: params.url,
				position: params.position,
				priority: params.priority ?? 0,
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"trustBadge",
				id,
				badge as unknown as Record<string, unknown>,
			);
			return badge;
		},

		async getBadge(id) {
			const raw = await data.get("trustBadge", id);
			return (raw as unknown as TrustBadge) ?? null;
		},

		async updateBadge(id, params) {
			const existing = await data.get("trustBadge", id);
			if (!existing) return null;

			const badge = existing as unknown as TrustBadge;
			const updated: TrustBadge = {
				...badge,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? {
							description:
								params.description === null ? undefined : params.description,
						}
					: {}),
				...(params.icon !== undefined ? { icon: params.icon } : {}),
				...(params.url !== undefined
					? {
							url: params.url === null ? undefined : params.url,
						}
					: {}),
				...(params.position !== undefined ? { position: params.position } : {}),
				...(params.priority !== undefined ? { priority: params.priority } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: new Date(),
			};

			await data.upsert(
				"trustBadge",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteBadge(id) {
			const existing = await data.get("trustBadge", id);
			if (!existing) return false;
			await data.delete("trustBadge", id);
			return true;
		},

		async listBadges(params) {
			const where: Record<string, unknown> = {};
			if (params?.position) where.position = params.position;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const badges = (await data.findMany("trustBadge", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as unknown as TrustBadge[];

			return badges.sort((a, b) => {
				if (b.priority !== a.priority) return b.priority - a.priority;
				return a.name.localeCompare(b.name);
			});
		},

		async countBadges(params) {
			const where: Record<string, unknown> = {};
			if (params?.position) where.position = params.position;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const badges = (await data.findMany("trustBadge", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as TrustBadge[];

			return badges.length;
		},

		// --- Admin Queries ---

		async listEvents(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.eventType) where.eventType = params.eventType;

			const events = (await data.findMany("activityEvent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as ActivityEvent[];

			const sorted = events.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const skip = params?.skip ?? 0;
			const take = params?.take ?? 50;
			return sorted.slice(skip, skip + take);
		},

		async countEvents(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.eventType) where.eventType = params.eventType;

			const events = (await data.findMany("activityEvent", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as ActivityEvent[];

			return events.length;
		},

		async cleanupEvents(olderThanDays) {
			const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

			const allEvents = (await data.findMany(
				"activityEvent",
				{},
			)) as unknown as ActivityEvent[];

			const toDelete = allEvents.filter((e) => new Date(e.createdAt) < cutoff);

			for (const event of toDelete) {
				await data.delete("activityEvent", event.id);
			}

			return toDelete.length;
		},

		async getActivitySummary(params) {
			const cutoff = getPeriodDate(params?.period ?? "24h");

			const allEvents = (await data.findMany(
				"activityEvent",
				{},
			)) as unknown as ActivityEvent[];

			const events = allEvents.filter((e) => new Date(e.createdAt) >= cutoff);

			let totalPurchases = 0;
			let totalViews = 0;
			let totalCartAdds = 0;
			const uniqueProductIds = new Set<string>();

			const productMap = new Map<string, TrendingProduct>();

			for (const event of events) {
				uniqueProductIds.add(event.productId);

				switch (event.eventType) {
					case "view":
						totalViews++;
						break;
					case "purchase":
						totalPurchases++;
						break;
					case "cart_add":
						totalCartAdds++;
						break;
				}

				const existing = productMap.get(event.productId);
				if (existing) {
					existing.eventCount++;
					if (event.eventType === "purchase") {
						existing.purchaseCount++;
					}
				} else {
					productMap.set(event.productId, {
						productId: event.productId,
						productName: event.productName,
						productSlug: event.productSlug,
						productImage: event.productImage,
						eventCount: 1,
						purchaseCount: event.eventType === "purchase" ? 1 : 0,
					});
				}
			}

			const topProducts = Array.from(productMap.values())
				.sort((a, b) => b.eventCount - a.eventCount)
				.slice(0, 10);

			return {
				totalEvents: events.length,
				totalPurchases,
				totalViews,
				totalCartAdds,
				uniqueProducts: uniqueProductIds.size,
				topProducts,
			};
		},
	};
}
