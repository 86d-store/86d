import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	PriceEntry,
	PriceList,
	PriceListController,
	PriceListStats,
	ResolvedPrice,
} from "./service";

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

function isPriceListCurrentlyActive(pl: PriceList): boolean {
	if (pl.status !== "active") return false;
	const now = new Date();
	if (pl.startsAt && now < pl.startsAt) return false;
	if (pl.endsAt && now > pl.endsAt) return false;
	return true;
}

function matchesQuantityTier(
	entry: PriceEntry,
	quantity: number | undefined,
): boolean {
	if (quantity == null) return true;
	if (entry.minQuantity != null && quantity < entry.minQuantity) return false;
	if (entry.maxQuantity != null && quantity > entry.maxQuantity) return false;
	return true;
}

export function createPriceListController(
	data: ModuleDataService,
): PriceListController {
	return {
		// ── Price Lists ─────────────────────────────────────

		async createPriceList(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const priceList: PriceList = {
				id,
				name: params.name,
				slug: params.slug,
				priority: params.priority ?? 0,
				status: params.status ?? "active",
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.currency != null && { currency: params.currency }),
				...(params.startsAt != null && { startsAt: params.startsAt }),
				...(params.endsAt != null && { endsAt: params.endsAt }),
				...(params.customerGroupId != null && {
					customerGroupId: params.customerGroupId,
				}),
			};
			await data.upsert("priceList", id, priceList as Record<string, unknown>);
			return priceList;
		},

		async getPriceList(id) {
			const raw = await data.get("priceList", id);
			return (raw as unknown as PriceList) ?? null;
		},

		async getPriceListBySlug(slug) {
			const results = (await data.findMany("priceList", {
				where: { slug },
			})) as unknown as PriceList[];
			return results[0] ?? null;
		},

		async updatePriceList(id, params) {
			const existing = await data.get("priceList", id);
			if (!existing) return null;

			const current = existing as unknown as PriceList;

			const base: PriceList = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				priority: params.priority ?? current.priority,
				status: params.status ?? current.status,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const optionalFields: Partial<PriceList> = {};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) optionalFields.description = descVal;

			const currVal =
				params.currency === null ? null : (params.currency ?? current.currency);
			if (currVal != null) optionalFields.currency = currVal;

			const startsVal =
				params.startsAt === null ? null : (params.startsAt ?? current.startsAt);
			if (startsVal != null) optionalFields.startsAt = startsVal;

			const endsVal =
				params.endsAt === null ? null : (params.endsAt ?? current.endsAt);
			if (endsVal != null) optionalFields.endsAt = endsVal;

			const groupVal =
				params.customerGroupId === null
					? null
					: (params.customerGroupId ?? current.customerGroupId);
			if (groupVal != null) optionalFields.customerGroupId = groupVal;

			const updated: PriceList = { ...base, ...optionalFields };

			await data.upsert("priceList", id, updated as Record<string, unknown>);
			return updated;
		},

		async deletePriceList(id) {
			const existing = await data.get("priceList", id);
			if (!existing) return false;

			// Cascade: remove all price entries
			const entries = (await data.findMany("priceEntry", {
				where: { priceListId: id },
			})) as unknown as PriceEntry[];
			for (const entry of entries) {
				await data.delete("priceEntry", entry.id);
			}

			await data.delete("priceList", id);
			return true;
		},

		async listPriceLists(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;
			if (params?.customerGroupId !== undefined)
				where.customerGroupId = params.customerGroupId;

			return (await data.findMany(
				"priceList",
				buildFindOptions({
					where,
					orderBy: { priority: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as PriceList[];
		},

		async countPriceLists(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;
			if (params?.customerGroupId !== undefined)
				where.customerGroupId = params.customerGroupId;

			const results = (await data.findMany("priceList", {
				where,
			})) as unknown as PriceList[];
			return results.length;
		},

		// ── Price Entries ────────────────────────────────────

		async setPrice(params) {
			// Upsert: find existing entry for this priceList + product combo
			const existing = (await data.findMany("priceEntry", {
				where: {
					priceListId: params.priceListId,
					productId: params.productId,
				},
			})) as unknown as PriceEntry[];

			// If minQuantity is specified, look for an exact tier match
			const match = existing.find((e) => {
				if (params.minQuantity != null || params.maxQuantity != null) {
					return (
						(e.minQuantity ?? null) === (params.minQuantity ?? null) &&
						(e.maxQuantity ?? null) === (params.maxQuantity ?? null)
					);
				}
				// No quantity tier: match entries without quantity tier
				return e.minQuantity == null && e.maxQuantity == null;
			});

			const id = match?.id ?? crypto.randomUUID();
			const entry: PriceEntry = {
				id,
				priceListId: params.priceListId,
				productId: params.productId,
				price: params.price,
				createdAt: match?.createdAt ?? new Date(),
				...(params.compareAtPrice != null && {
					compareAtPrice: params.compareAtPrice,
				}),
				...(params.minQuantity != null && {
					minQuantity: params.minQuantity,
				}),
				...(params.maxQuantity != null && {
					maxQuantity: params.maxQuantity,
				}),
			};

			await data.upsert("priceEntry", id, entry as Record<string, unknown>);
			return entry;
		},

		async getPrice(priceListId, productId) {
			const results = (await data.findMany("priceEntry", {
				where: { priceListId, productId },
			})) as unknown as PriceEntry[];
			return results[0] ?? null;
		},

		async removePrice(priceListId, productId) {
			const entries = (await data.findMany("priceEntry", {
				where: { priceListId, productId },
			})) as unknown as PriceEntry[];

			if (entries.length === 0) return false;

			for (const entry of entries) {
				await data.delete("priceEntry", entry.id);
			}
			return true;
		},

		async listPrices(priceListId, params) {
			return (await data.findMany(
				"priceEntry",
				buildFindOptions({
					where: { priceListId },
					orderBy: { createdAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as PriceEntry[];
		},

		async countPrices(priceListId) {
			const results = (await data.findMany("priceEntry", {
				where: { priceListId },
			})) as unknown as PriceEntry[];
			return results.length;
		},

		async bulkSetPrices(priceListId, entries) {
			const results: PriceEntry[] = [];
			for (const entry of entries) {
				const result = await this.setPrice({
					priceListId,
					productId: entry.productId,
					price: entry.price,
					...(entry.compareAtPrice != null && {
						compareAtPrice: entry.compareAtPrice,
					}),
					...(entry.minQuantity != null && {
						minQuantity: entry.minQuantity,
					}),
					...(entry.maxQuantity != null && {
						maxQuantity: entry.maxQuantity,
					}),
				});
				results.push(result);
			}
			return results;
		},

		// ── Price Resolution ────────────────────────────────

		async resolvePrice(productId, params) {
			// Get all active price lists, ordered by priority
			const allLists = (await data.findMany("priceList", {
				orderBy: { priority: "asc" },
			})) as unknown as PriceList[];

			const activeLists = allLists
				.filter((pl) => {
					if (!isPriceListCurrentlyActive(pl)) return false;
					// Filter by currency if specified
					if (
						params?.currency &&
						pl.currency &&
						pl.currency !== params.currency
					)
						return false;
					// Filter by customer group if specified
					if (params?.customerGroupId) {
						// Include lists with no group restriction OR matching group
						if (
							pl.customerGroupId &&
							pl.customerGroupId !== params.customerGroupId
						)
							return false;
					} else {
						// No customer group: only include lists without group restriction
						if (pl.customerGroupId) return false;
					}
					return true;
				})
				// Sort by priority ascending (lowest = highest priority)
				.sort((a, b) => a.priority - b.priority);

			// Check each price list (already sorted by priority) for this product
			for (const pl of activeLists) {
				const entries = (await data.findMany("priceEntry", {
					where: { priceListId: pl.id, productId },
				})) as unknown as PriceEntry[];

				// Find the best matching entry for the given quantity
				const matching = entries.filter((e) =>
					matchesQuantityTier(e, params?.quantity),
				);

				if (matching.length > 0) {
					// Pick the entry with the lowest price
					const best = matching.reduce((a, b) => (a.price < b.price ? a : b));
					return {
						price: best.price,
						compareAtPrice: best.compareAtPrice ?? null,
						priceListId: pl.id,
						priceListName: pl.name,
					};
				}
			}

			return null;
		},

		async resolvePrices(productIds, params) {
			const result: Record<string, ResolvedPrice> = {};
			for (const productId of productIds) {
				const resolved = await this.resolvePrice(productId, params);
				if (resolved) {
					result[productId] = resolved;
				}
			}
			return result;
		},

		// ── Stats ────────────────────────────────────────────

		async getStats() {
			const allLists = (await data.findMany(
				"priceList",
				{},
			)) as unknown as PriceList[];
			const allEntries = (await data.findMany(
				"priceEntry",
				{},
			)) as unknown as PriceEntry[];

			const priceListIds = new Set(allEntries.map((e) => e.priceListId));

			const stats: PriceListStats = {
				totalPriceLists: allLists.length,
				activePriceLists: allLists.filter((pl) => pl.status === "active")
					.length,
				scheduledPriceLists: allLists.filter((pl) => pl.status === "scheduled")
					.length,
				inactivePriceLists: allLists.filter((pl) => pl.status === "inactive")
					.length,
				totalEntries: allEntries.length,
				priceListsWithEntries: priceListIds.size,
			};
			return stats;
		},
	};
}
