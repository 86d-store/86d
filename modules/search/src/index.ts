import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { OpenAIEmbeddingProvider } from "./embedding-provider";
import { MeiliSearchProvider } from "./meilisearch-provider";
import { searchStorage } from "./schema";
import { createSearchController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { EmbeddingProvider } from "./embedding-provider";
export type { MeiliSearchProvider } from "./meilisearch-provider";
export type {
	SearchClick,
	SearchController,
	SearchFacets,
	SearchHighlight,
	SearchIndexItem,
	SearchQuery,
	SearchResult,
	SearchSortField,
	SearchSynonym,
} from "./service";
export { OpenAIEmbeddingProvider };

export interface SearchOptions extends ModuleConfig {
	/** Maximum number of search results per query */
	maxResults?: number;
	/** OpenAI API key for AI-powered semantic search */
	openaiApiKey?: string;
	/** OpenRouter API key (alternative to OpenAI) */
	openrouterApiKey?: string;
	/** Embedding model name (default: text-embedding-3-small) */
	embeddingModel?: string;
	/** MeiliSearch host URL (e.g. http://localhost:7700) */
	meilisearchHost?: string;
	/** MeiliSearch API key (master or search key) */
	meilisearchApiKey?: string;
	/** MeiliSearch index name (default: "search") */
	meilisearchIndexUid?: string;
}

export default function search(options?: SearchOptions): Module {
	// Create embedding provider from env-var-based API keys
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

	// Create MeiliSearch provider when host and API key are configured
	let meiliProvider: MeiliSearchProvider | undefined;
	if (options?.meilisearchHost && options?.meilisearchApiKey) {
		meiliProvider = new MeiliSearchProvider(
			options.meilisearchHost,
			options.meilisearchApiKey,
			options.meilisearchIndexUid,
		);
	}

	return {
		id: "search",
		version: "0.1.0",
		storage: searchStorage,
		exports: {
			read: ["searchIndexCount", "popularTerms"],
		},
		events: {
			emits: [
				"search.queried",
				"search.indexed",
				"search.removed",
				"search.clicked",
			],
		},
		init: async (ctx: ModuleContext) => {
			if (meiliProvider) {
				void meiliProvider.configureIndex();
			}
			const controller = createSearchController(
				ctx.data,
				embeddingProvider,
				meiliProvider,
			);

			ctx.events?.on("product.created", async (event) => {
				const p = event.payload as {
					productId: string;
					name: string;
					slug: string;
					price?: number;
					status?: string;
				};
				if (p.status && p.status !== "active") return;
				await controller
					.indexItem({
						entityType: "product",
						entityId: p.productId,
						title: p.name,
						url: `/products/${p.slug}`,
						metadata: { price: p.price, status: p.status },
					})
					.catch(() => {});
			});

			ctx.events?.on("product.updated", async (event) => {
				const p = event.payload as {
					productId: string;
					name: string;
					slug: string;
					price?: number;
					status?: string;
				};
				if (p.status && p.status !== "active") {
					await controller
						.removeFromIndex("product", p.productId)
						.catch(() => {});
					return;
				}
				await controller
					.indexItem({
						entityType: "product",
						entityId: p.productId,
						title: p.name,
						url: `/products/${p.slug}`,
						metadata: { price: p.price, status: p.status },
					})
					.catch(() => {});
			});

			ctx.events?.on("product.deleted", async (event) => {
				const p = event.payload as { productId: string };
				await controller
					.removeFromIndex("product", p.productId)
					.catch(() => {});
			});

			return { controllers: { search: controller } };
		},
		search: { store: "/search/store-search" },
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/search",
					component: "SearchAnalytics",
					label: "Search",
					icon: "MagnifyingGlass",
					group: "System",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/search",
					component: "SearchPage",
				},
			],
		},
		options,
	};
}
