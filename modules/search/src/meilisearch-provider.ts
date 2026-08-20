/**
 * MeiliSearch provider for real search engine integration.
 *
 * When configured with a MeiliSearch host and API key, the search module
 * delegates indexing and querying to a dedicated MeiliSearch instance instead
 * of relying on in-application lexical search. Falls back gracefully when
 * the MeiliSearch instance is unreachable.
 */

export interface MeiliSearchDocument {
	id: string;
	entityType: string;
	entityId: string;
	title: string;
	body?: string | undefined;
	tags: string[];
	url: string;
	image?: string | undefined;
	indexedAt: string;
	[key: string]: unknown;
}

export interface MeiliSearchHit {
	id: string;
	entityType: string;
	entityId: string;
	title: string;
	body?: string;
	tags: string[];
	url: string;
	image?: string;
	indexedAt: string;
	_formatted?: {
		title?: string;
		body?: string;
		[key: string]: string | undefined;
	};
	_rankingScore?: number;
	[key: string]: unknown;
}

export interface MeiliSearchResponse {
	hits: MeiliSearchHit[];
	query: string;
	processingTimeMs: number;
	estimatedTotalHits?: number;
	totalHits?: number;
	facetDistribution?: Record<string, Record<string, number>>;
}

interface MeiliSearchTaskResponse {
	taskUid: number;
	indexUid: string;
	status: "enqueued" | "processing" | "succeeded" | "failed";
	type: string;
	enqueuedAt: string;
}

interface MeiliSearchError {
	message: string;
	code: string;
	type: string;
	link?: string;
}

interface MeiliSearchHealthResponse {
	status: "available";
}

interface MeiliSearchStatsResponse {
	numberOfDocuments: number;
	isIndexing: boolean;
	fieldDistribution: Record<string, number>;
}

export class MeiliSearchProvider {
	private readonly host: string;
	private readonly apiKey: string;
	private readonly indexUid: string;

	constructor(host: string, apiKey: string, indexUid = "search") {
		// Strip trailing slash from host
		this.host = host.replace(/\/+$/, "");
		this.apiKey = apiKey;
		this.indexUid = indexUid;
	}

	/**
	 * Add or replace documents in the MeiliSearch index.
	 * MeiliSearch uses the `id` field as the primary key by default.
	 */
	async addDocuments(
		documents: MeiliSearchDocument[],
	): Promise<MeiliSearchTaskResponse> {
		const res = await this.request(
			`/indexes/${this.indexUid}/documents`,
			"POST",
			documents,
		);
		return res as MeiliSearchTaskResponse;
	}

	/**
	 * Delete a single document by its ID.
	 */
	async deleteDocument(documentId: string): Promise<MeiliSearchTaskResponse> {
		const res = await this.request(
			`/indexes/${this.indexUid}/documents/${encodeURIComponent(documentId)}`,
			"DELETE",
		);
		return res as MeiliSearchTaskResponse;
	}

	/**
	 * Search the MeiliSearch index.
	 */
	async search(
		query: string,
		options?: {
			limit?: number | undefined;
			offset?: number | undefined;
			filter?: string | undefined;
			sort?: string[] | undefined;
			facets?: string[] | undefined;
			attributesToHighlight?: string[] | undefined;
			highlightPreTag?: string | undefined;
			highlightPostTag?: string | undefined;
			showRankingScore?: boolean | undefined;
			matchingStrategy?: "last" | "all" | "frequency" | undefined;
		},
	): Promise<MeiliSearchResponse> {
		const body: Record<string, unknown> = { q: query };

		if (options?.limit !== undefined) body.limit = options.limit;
		if (options?.offset !== undefined) body.offset = options.offset;
		if (options?.filter) body.filter = options.filter;
		if (options?.sort) body.sort = options.sort;
		if (options?.facets) body.facets = options.facets;
		if (options?.attributesToHighlight) {
			body.attributesToHighlight = options.attributesToHighlight;
		}
		if (options?.highlightPreTag) {
			body.highlightPreTag = options.highlightPreTag;
		}
		if (options?.highlightPostTag) {
			body.highlightPostTag = options.highlightPostTag;
		}
		if (options?.showRankingScore) body.showRankingScore = true;
		if (options?.matchingStrategy) {
			body.matchingStrategy = options.matchingStrategy;
		}

		const res = await this.request(
			`/indexes/${this.indexUid}/search`,
			"POST",
			body,
		);
		return res as MeiliSearchResponse;
	}

	/**
	 * Check if the MeiliSearch instance is reachable and healthy.
	 */
	async isHealthy(): Promise<boolean> {
		try {
			const res = await this.request("/health", "GET");
			return (res as MeiliSearchHealthResponse).status === "available";
		} catch {
			return false;
		}
	}

	/**
	 * Get index statistics (document count, indexing status).
	 */
	async getStats(): Promise<MeiliSearchStatsResponse | null> {
		try {
			const res = await this.request(`/indexes/${this.indexUid}/stats`, "GET");
			return res as MeiliSearchStatsResponse;
		} catch {
			return null;
		}
	}

	/**
	 * Configure index settings: filterable and sortable attributes.
	 * Called once on init to ensure MeiliSearch knows which fields to index.
	 */
	async configureIndex(): Promise<void> {
		try {
			await this.request(`/indexes/${this.indexUid}/settings`, "PATCH", {
				filterableAttributes: ["entityType", "tags"],
				sortableAttributes: ["indexedAt", "title"],
				searchableAttributes: ["title", "body", "tags"],
			});
		} catch {
			// Non-critical — index may already be configured or not yet exist.
			// MeiliSearch auto-creates indexes on first document addition.
		}
	}

	private async request(
		path: string,
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		body?: unknown,
	): Promise<unknown> {
		const url = `${this.host}${path}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.apiKey}`,
		};
		if (body !== undefined) {
			headers["Content-Type"] = "application/json";
		}

		const res = await fetch(url, {
			method,
			headers,
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		if (!res.ok) {
			let errorMessage = `MeiliSearch ${method} ${path} failed: HTTP ${res.status}`;
			try {
				const err = (await res.json()) as MeiliSearchError;
				if (err.message) {
					errorMessage = `MeiliSearch error: ${err.message} (${err.code})`;
				}
			} catch {
				// Response body may not be JSON
			}
			throw new Error(errorMessage);
		}

		// DELETE and some endpoints may return 204 No Content
		if (res.status === 204) return {};

		return res.json();
	}
}
