import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { EmbeddingProvider } from "./embedding-provider";
import { cosineSimilarity } from "./embedding-provider";
import type {
	CoOccurrence,
	ProductEmbedding,
	ProductInteraction,
	RecommendationClick,
	RecommendationController,
	RecommendationImpression,
	RecommendationRule,
	RecommendationSurface,
	RecommendedProduct,
} from "./service";

const DEFAULT_TAKE = 10;

async function computeAnalytics(data: ModuleDataService) {
	const allImpressions = (await data.findMany(
		"recommendationImpression",
		{},
	)) as unknown as RecommendationImpression[];
	const allClicks = (await data.findMany(
		"recommendationClick",
		{},
	)) as unknown as RecommendationClick[];

	const totalImpressions = allImpressions.length;
	const totalServedItems = allImpressions.reduce(
		(sum, i) => sum + (Array.isArray(i.productIds) ? i.productIds.length : 0),
		0,
	);
	const totalClicks = allClicks.length;

	const impressionIdsWithClick = new Set(allClicks.map((c) => c.impressionId));
	const clickThroughRate =
		totalImpressions > 0
			? Math.round((impressionIdsWithClick.size / totalImpressions) * 100)
			: 0;

	const avgClickPosition =
		allClicks.length > 0
			? Math.round(
					(allClicks.reduce((sum, c) => sum + c.position, 0) /
						allClicks.length) *
						10,
				) / 10
			: 0;

	const surfaceStats = new Map<
		RecommendationSurface,
		{ impressions: number; clickedImpressionIds: Set<string> }
	>();
	for (const imp of allImpressions) {
		const existing = surfaceStats.get(imp.surface);
		if (existing) {
			existing.impressions += 1;
		} else {
			surfaceStats.set(imp.surface, {
				impressions: 1,
				clickedImpressionIds: new Set(),
			});
		}
	}
	for (const click of allClicks) {
		const existing = surfaceStats.get(click.surface);
		if (existing) {
			existing.clickedImpressionIds.add(click.impressionId);
		}
	}
	const bySurface = Array.from(surfaceStats.entries())
		.map(([surface, s]) => ({
			surface,
			impressions: s.impressions,
			clicks: s.clickedImpressionIds.size,
			clickThroughRate:
				s.impressions > 0
					? Math.round((s.clickedImpressionIds.size / s.impressions) * 100)
					: 0,
		}))
		.sort((a, b) => b.impressions - a.impressions);

	return {
		totalImpressions,
		totalServedItems,
		totalClicks,
		clickThroughRate,
		avgClickPosition,
		bySurface,
	};
}

export function createRecommendationController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	embeddingProvider?: EmbeddingProvider | undefined,
): RecommendationController {
	return {
		// --- Rules ---

		async createRule(params) {
			const id = crypto.randomUUID();
			const rule: RecommendationRule = {
				id,
				name: params.name,
				strategy: params.strategy,
				sourceProductId: params.sourceProductId,
				targetProductIds: params.targetProductIds,
				weight: params.weight ?? 1,
				isActive: params.isActive ?? true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			await data.upsert(
				"recommendationRule",
				id,
				rule as Record<string, unknown>,
			);
			return rule;
		},

		async updateRule(id, params) {
			const existing = (await data.get(
				"recommendationRule",
				id,
			)) as unknown as RecommendationRule | null;
			if (!existing) return null;

			const updated: RecommendationRule = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.strategy !== undefined ? { strategy: params.strategy } : {}),
				...(params.sourceProductId !== undefined
					? { sourceProductId: params.sourceProductId }
					: {}),
				...(params.targetProductIds !== undefined
					? { targetProductIds: params.targetProductIds }
					: {}),
				...(params.weight !== undefined ? { weight: params.weight } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"recommendationRule",
				id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async deleteRule(id) {
			const existing = await data.get("recommendationRule", id);
			if (!existing) return false;
			await data.delete("recommendationRule", id);
			return true;
		},

		async getRule(id) {
			return (await data.get(
				"recommendationRule",
				id,
			)) as unknown as RecommendationRule | null;
		},

		async listRules(params) {
			const where: Record<string, unknown> = {};
			if (params?.strategy) where.strategy = params.strategy;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const rules = (await data.findMany("recommendationRule", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as unknown as RecommendationRule[];

			return rules.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
		},

		async countRules(params) {
			const where: Record<string, unknown> = {};
			if (params?.strategy) where.strategy = params.strategy;
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const rules = await data.findMany("recommendationRule", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			});
			return rules.length;
		},

		// --- Co-occurrences ---

		async recordPurchase(productIds) {
			if (productIds.length < 2) return 0;

			let pairsRecorded = 0;
			// Generate all pairs
			for (let i = 0; i < productIds.length; i++) {
				for (let j = i + 1; j < productIds.length; j++) {
					// Canonical ordering so (A,B) == (B,A)
					const [id1, id2] =
						productIds[i] < productIds[j]
							? [productIds[i], productIds[j]]
							: [productIds[j], productIds[i]];

					// Find existing co-occurrence
					const existing = (await data.findMany("coOccurrence", {
						where: { productId1: id1, productId2: id2 },
					})) as unknown as CoOccurrence[];

					if (existing.length > 0) {
						const entry = existing[0];
						const updated = {
							...entry,
							count: entry.count + 1,
							lastOccurredAt: new Date(),
						};
						await data.upsert(
							"coOccurrence",
							entry.id,
							updated as Record<string, unknown>,
						);
					} else {
						const id = crypto.randomUUID();
						const entry = {
							id,
							productId1: id1,
							productId2: id2,
							count: 1,
							lastOccurredAt: new Date(),
						};
						await data.upsert(
							"coOccurrence",
							id,
							entry as Record<string, unknown>,
						);
					}
					pairsRecorded += 1;
				}
			}
			return pairsRecorded;
		},

		async getCoOccurrences(productId, params) {
			const take = params?.take ?? DEFAULT_TAKE;

			// Find where productId is either id1 or id2
			const asId1 = (await data.findMany("coOccurrence", {
				where: { productId1: productId },
			})) as unknown as CoOccurrence[];

			const asId2 = (await data.findMany("coOccurrence", {
				where: { productId2: productId },
			})) as unknown as CoOccurrence[];

			const all = [...asId1, ...asId2];

			return all.sort((a, b) => b.count - a.count).slice(0, take);
		},

		// --- Interactions ---

		async trackInteraction(params) {
			if (!params.customerId && !params.sessionId) {
				throw new Error("Either customerId or sessionId is required");
			}

			const id = crypto.randomUUID();
			const interaction: ProductInteraction = {
				id,
				productId: params.productId,
				customerId: params.customerId,
				sessionId: params.sessionId,
				type: params.type,
				productName: params.productName,
				productSlug: params.productSlug,
				productImage: params.productImage,
				productPrice: params.productPrice,
				productCategory: params.productCategory,
				createdAt: new Date(),
			};
			await data.upsert(
				"productInteraction",
				id,
				interaction as Record<string, unknown>,
			);
			void events?.emit("recommendation.interaction.tracked", {
				productId: interaction.productId,
				type: interaction.type,
				customerId: interaction.customerId,
				sessionId: interaction.sessionId,
			});
			return interaction;
		},

		// --- Recommendations ---

		async getForProduct(productId, params) {
			const take = params?.take ?? DEFAULT_TAKE;
			const strategy = params?.strategy;
			const results: RecommendedProduct[] = [];

			// Manual rules
			if (!strategy || strategy === "manual") {
				const rules = (await data.findMany("recommendationRule", {
					where: { isActive: true },
				})) as unknown as RecommendationRule[];

				const matching = rules.filter(
					(r) => r.strategy === "manual" && r.sourceProductId === productId,
				);

				for (const rule of matching) {
					for (const targetId of rule.targetProductIds) {
						// Get product info from interactions if available
						const interactions = (await data.findMany("productInteraction", {
							where: { productId: targetId },
							take: 1,
						})) as unknown as ProductInteraction[];

						const info = interactions[0];
						results.push({
							productId: targetId,
							productName: info?.productName ?? targetId,
							productSlug: info?.productSlug ?? targetId,
							productImage: info?.productImage,
							productPrice: info?.productPrice,
							score: rule.weight,
							strategy: "manual",
						});
					}
				}
			}

			// Bought together
			if (!strategy || strategy === "bought_together") {
				const coOccurrences = (await data.findMany("coOccurrence", {
					where: { productId1: productId },
				})) as unknown as CoOccurrence[];

				const coOccurrences2 = (await data.findMany("coOccurrence", {
					where: { productId2: productId },
				})) as unknown as CoOccurrence[];

				const allCo = [...coOccurrences, ...coOccurrences2];

				for (const co of allCo) {
					const relatedId =
						co.productId1 === productId ? co.productId2 : co.productId1;

					// Skip if already in results
					if (results.some((r) => r.productId === relatedId)) continue;

					const interactions = (await data.findMany("productInteraction", {
						where: { productId: relatedId },
						take: 1,
					})) as unknown as ProductInteraction[];

					const info = interactions[0];
					results.push({
						productId: relatedId,
						productName: info?.productName ?? relatedId,
						productSlug: info?.productSlug ?? relatedId,
						productImage: info?.productImage,
						productPrice: info?.productPrice,
						score: co.count,
						strategy: "bought_together",
					});
				}
			}

			// AI similar
			if (strategy === "ai_similar" || (!strategy && embeddingProvider)) {
				const aiResults = await this.getAISimilar(productId, { take });
				for (const rec of aiResults) {
					if (!results.some((r) => r.productId === rec.productId)) {
						results.push(rec);
					}
				}
			}

			// Sort by score descending, limit
			const sorted = results.sort((a, b) => b.score - a.score).slice(0, take);
			if (sorted.length > 0) {
				void events?.emit("recommendation.served", {
					productId,
					count: sorted.length,
					strategies: [...new Set(sorted.map((r) => r.strategy))],
				});
			}
			return sorted;
		},

		async getTrending(params) {
			const take = params?.take ?? DEFAULT_TAKE;
			const since = params?.since ?? new Date(Date.now() - 7 * 86_400_000); // 7 days default

			const allInteractions = (await data.findMany(
				"productInteraction",
				{},
			)) as unknown as ProductInteraction[];

			// Filter to recent and aggregate by product
			const sinceTime = since.getTime();
			const productScores = new Map<
				string,
				{
					productId: string;
					productName: string;
					productSlug: string;
					productImage?: string | undefined;
					productPrice?: number | undefined;
					score: number;
				}
			>();

			for (const interaction of allInteractions) {
				if (new Date(interaction.createdAt).getTime() < sinceTime) continue;

				// Weight: purchase=3, add_to_cart=2, view=1
				const weight =
					interaction.type === "purchase"
						? 3
						: interaction.type === "add_to_cart"
							? 2
							: 1;

				const existing = productScores.get(interaction.productId);
				if (existing) {
					existing.score += weight;
				} else {
					productScores.set(interaction.productId, {
						productId: interaction.productId,
						productName: interaction.productName,
						productSlug: interaction.productSlug,
						productImage: interaction.productImage,
						productPrice: interaction.productPrice,
						score: weight,
					});
				}
			}

			return Array.from(productScores.values())
				.filter((p) => p.productSlug && p.productName)
				.sort((a, b) => b.score - a.score)
				.slice(0, take)
				.map((p) => ({ ...p, strategy: "trending" as const }));
		},

		async getPersonalized(customerId, params) {
			const take = params?.take ?? DEFAULT_TAKE;

			// Get customer's interaction history
			const customerInteractions = (await data.findMany("productInteraction", {
				where: { customerId },
			})) as unknown as ProductInteraction[];

			if (customerInteractions.length === 0) return [];

			// Collect categories the customer has interacted with
			const customerCategories = new Set<string>();
			const customerProductIds = new Set<string>();
			for (const interaction of customerInteractions) {
				customerProductIds.add(interaction.productId);
				if (interaction.productCategory) {
					customerCategories.add(interaction.productCategory);
				}
			}

			if (customerCategories.size === 0) {
				// No category data — fall back to bought-together from purchased products
				const purchasedIds = customerInteractions
					.filter((i) => i.type === "purchase")
					.map((i) => i.productId);

				const results: RecommendedProduct[] = [];
				for (const pid of purchasedIds) {
					const coOcc1 = (await data.findMany("coOccurrence", {
						where: { productId1: pid },
					})) as unknown as CoOccurrence[];
					const coOcc2 = (await data.findMany("coOccurrence", {
						where: { productId2: pid },
					})) as unknown as CoOccurrence[];

					for (const co of [...coOcc1, ...coOcc2]) {
						const relatedId =
							co.productId1 === pid ? co.productId2 : co.productId1;
						if (customerProductIds.has(relatedId)) continue;
						if (results.some((r) => r.productId === relatedId)) continue;

						const info = (await data.findMany("productInteraction", {
							where: { productId: relatedId },
							take: 1,
						})) as unknown as ProductInteraction[];

						results.push({
							productId: relatedId,
							productName: info[0]?.productName ?? relatedId,
							productSlug: info[0]?.productSlug ?? relatedId,
							productImage: info[0]?.productImage,
							productPrice: info[0]?.productPrice,
							score: co.count,
							strategy: "personalized",
						});
					}
				}

				return results.sort((a, b) => b.score - a.score).slice(0, take);
			}

			// Find other products in the same categories that the customer hasn't interacted with
			const allInteractions = (await data.findMany(
				"productInteraction",
				{},
			)) as unknown as ProductInteraction[];

			const candidateScores = new Map<
				string,
				{
					productId: string;
					productName: string;
					productSlug: string;
					productImage?: string | undefined;
					productPrice?: number | undefined;
					score: number;
				}
			>();

			for (const interaction of allInteractions) {
				// Skip products the customer already interacted with
				if (customerProductIds.has(interaction.productId)) continue;

				// Only consider products in matching categories
				if (
					!interaction.productCategory ||
					!customerCategories.has(interaction.productCategory)
				) {
					continue;
				}

				const weight =
					interaction.type === "purchase"
						? 3
						: interaction.type === "add_to_cart"
							? 2
							: 1;

				const existing = candidateScores.get(interaction.productId);
				if (existing) {
					existing.score += weight;
				} else {
					candidateScores.set(interaction.productId, {
						productId: interaction.productId,
						productName: interaction.productName,
						productSlug: interaction.productSlug,
						productImage: interaction.productImage,
						productPrice: interaction.productPrice,
						score: weight,
					});
				}
			}

			return Array.from(candidateScores.values())
				.sort((a, b) => b.score - a.score)
				.slice(0, take)
				.map((p) => ({ ...p, strategy: "personalized" as const }));
		},

		// --- AI embeddings ---

		async generateProductEmbedding(productId, text, metadata) {
			if (!embeddingProvider) return null;

			const embedding = await embeddingProvider.generateEmbedding(text);
			if (!embedding) return null;

			// Check for existing embedding for this product
			const existing = (await data.findMany("productEmbedding", {
				where: { productId },
			})) as unknown as ProductEmbedding[];

			const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
			const entry: ProductEmbedding = {
				id,
				productId,
				embedding,
				text,
				createdAt: new Date(),
			};

			await data.upsert("productEmbedding", id, {
				...entry,
				...(metadata ?? {}),
			} as Record<string, unknown>);

			return entry;
		},

		async getAISimilar(productId, params) {
			if (!embeddingProvider) return [];

			const take = params?.take ?? DEFAULT_TAKE;

			// Get source product embedding
			const sourceEmbeddings = (await data.findMany("productEmbedding", {
				where: { productId },
			})) as unknown as ProductEmbedding[];

			if (sourceEmbeddings.length === 0) return [];

			const sourceVec = sourceEmbeddings[0].embedding;
			if (!Array.isArray(sourceVec) || sourceVec.length === 0) return [];

			// Get all embeddings
			const allEmbeddings = (await data.findMany(
				"productEmbedding",
				{},
			)) as unknown as Array<
				ProductEmbedding & {
					productName?: string;
					productSlug?: string;
					productImage?: string;
					productPrice?: number;
				}
			>;

			// Score each by cosine similarity, excluding the source product
			const scored: RecommendedProduct[] = [];
			for (const entry of allEmbeddings) {
				if (entry.productId === productId) continue;
				if (
					!Array.isArray(entry.embedding) ||
					entry.embedding.length !== sourceVec.length
				) {
					continue;
				}

				const similarity = cosineSimilarity(sourceVec, entry.embedding);
				if (similarity <= 0) continue;

				// Look up product info from interactions if not stored on embedding
				let productName = entry.productName ?? entry.productId;
				let productSlug = entry.productSlug ?? entry.productId;
				let productImage = entry.productImage;
				let productPrice = entry.productPrice;

				if (!entry.productName) {
					const interactions = (await data.findMany("productInteraction", {
						where: { productId: entry.productId },
						take: 1,
					})) as unknown as ProductInteraction[];

					if (interactions.length > 0) {
						productName = interactions[0].productName;
						productSlug = interactions[0].productSlug;
						productImage = interactions[0].productImage;
						productPrice = interactions[0].productPrice;
					}
				}

				scored.push({
					productId: entry.productId,
					productName,
					productSlug,
					productImage,
					productPrice,
					score: similarity,
					strategy: "ai_similar",
				});
			}

			const results = scored.sort((a, b) => b.score - a.score).slice(0, take);
			if (results.length > 0) {
				void events?.emit("recommendation.served", {
					productId,
					count: results.length,
					strategies: ["ai_similar"],
				});
			}
			return results;
		},

		// --- Impressions & clicks ---

		async recordImpression(params) {
			const id = crypto.randomUUID();
			const impression: RecommendationImpression = {
				id,
				surface: params.surface,
				sourceProductId: params.sourceProductId,
				customerId: params.customerId,
				sessionId: params.sessionId,
				productIds: params.productIds,
				strategies: params.strategies,
				servedAt: new Date(),
			};
			await data.upsert(
				"recommendationImpression",
				id,
				impression as unknown as Record<string, unknown>,
			);
			return impression;
		},

		async recordClick(params) {
			const impression = (await data.get(
				"recommendationImpression",
				params.impressionId,
			)) as unknown as RecommendationImpression | null;
			if (!impression) return null;

			const productIds = Array.isArray(impression.productIds)
				? impression.productIds
				: [];
			if (!productIds.includes(params.productId)) return null;

			const id = crypto.randomUUID();
			const click: RecommendationClick = {
				id,
				impressionId: params.impressionId,
				surface: params.surface ?? impression.surface,
				productId: params.productId,
				position: params.position,
				strategy: params.strategy,
				clickedAt: new Date(),
			};
			await data.upsert(
				"recommendationClick",
				id,
				click as unknown as Record<string, unknown>,
			);
			return click;
		},

		async getAnalytics() {
			return computeAnalytics(data);
		},

		// --- Stats ---

		async getStats() {
			const allRules = await data.findMany("recommendationRule", {});
			const activeRules = (allRules as unknown as RecommendationRule[]).filter(
				(r) => r.isActive,
			);
			const allCo = await data.findMany("coOccurrence", {});
			const allInteractions = await data.findMany("productInteraction", {});
			const allEmbeddings = await data.findMany("productEmbedding", {});
			const analytics = await computeAnalytics(data);

			return {
				totalRules: allRules.length,
				activeRules: activeRules.length,
				totalCoOccurrences: allCo.length,
				totalInteractions: allInteractions.length,
				embeddingsCount: allEmbeddings.length,
				aiConfigured: Boolean(embeddingProvider),
				totalImpressions: analytics.totalImpressions,
				totalClicks: analytics.totalClicks,
				clickThroughRate: analytics.clickThroughRate,
				avgClickPosition: analytics.avgClickPosition,
			};
		},
	};
}
