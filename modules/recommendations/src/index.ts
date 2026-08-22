import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { OpenAIEmbeddingProvider } from "./embedding-provider";
import { recommendationsStorage } from "./schema";
import { createRecommendationController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { EmbeddingProvider } from "./embedding-provider";
export type {
	CoOccurrence,
	ProductEmbedding,
	ProductInteraction,
	RecommendationController,
	RecommendationRule,
	RecommendedProduct,
} from "./service";

export interface RecommendationsOptions extends ModuleConfig {
	/** Default number of recommendations to return. Default: 10. */
	defaultTake?: string;
	/** Trending window in days. Default: 7. */
	trendingWindowDays?: string;
	/** OpenAI API key for AI-powered similarity recommendations */
	openaiApiKey?: string;
	/** OpenRouter API key (alternative to OpenAI) */
	openrouterApiKey?: string;
	/** Embedding model name (default: text-embedding-3-small) */
	embeddingModel?: string;
}

export default function recommendations(
	options?: RecommendationsOptions,
): Module {
	let embeddingProvider: OpenAIEmbeddingProvider | undefined;
	if (options?.openaiApiKey) {
		embeddingProvider = new OpenAIEmbeddingProvider(options.openaiApiKey, {
			...(options.embeddingModel ? { model: options.embeddingModel } : {}),
		});
	} else if (options?.openrouterApiKey) {
		embeddingProvider = new OpenAIEmbeddingProvider(options.openrouterApiKey, {
			model: options.embeddingModel ?? "openai/text-embedding-3-small",
			baseUrl: "https://openrouter.ai/api/v1" as string,
		});
	}

	return {
		id: "recommendations",
		version: "0.1.0",
		storage: recommendationsStorage,
		exports: {
			read: [
				"recommendationRules",
				"coOccurrences",
				"productInteractions",
				"recommendedProducts",
				"productEmbeddings",
			],
		},
		events: {
			emits: ["recommendation.served", "recommendation.interaction.tracked"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createRecommendationController(
				ctx.data,
				ctx.events,
				embeddingProvider,
			);

			if (embeddingProvider) {
				ctx.events?.on("product.created", async (event) => {
					const p = event.payload as {
						productId: string;
						name: string;
						slug: string;
						price?: number;
					};
					await controller
						.generateProductEmbedding(p.productId, p.name, {
							productName: p.name,
							productSlug: p.slug,
							productPrice: p.price,
						})
						.catch(() => {});
				});

				ctx.events?.on("product.updated", async (event) => {
					const p = event.payload as {
						productId: string;
						name: string;
						slug: string;
						price?: number;
					};
					await controller
						.generateProductEmbedding(p.productId, p.name, {
							productName: p.name,
							productSlug: p.slug,
							productPrice: p.price,
						})
						.catch(() => {});
				});
			}

			return { controllers: { recommendations: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/recommendations",
					component: "RecommendationAdmin",
					label: "Recommendations",
					icon: "Sparkles",
					group: "Marketing",
				},
				{
					path: "/admin/recommendations/settings",
					component: "RecommendationSettings",
					label: "Settings",
					icon: "Gear",
					group: "Marketing",
				},
			],
		},
		options,
	};
}
