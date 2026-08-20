/**
 * Embedding provider for AI-powered semantic search.
 *
 * Calls OpenAI's text-embedding-3-small model to generate vector embeddings
 * for indexed items and search queries. When configured, search results are
 * ranked using a hybrid of lexical scoring and cosine similarity.
 */

interface EmbeddingResponse {
	data: Array<{ embedding: number[]; index: number }>;
	model: string;
	usage: { prompt_tokens: number; total_tokens: number };
}

interface EmbeddingErrorResponse {
	error: { message: string; type: string; code?: string };
}

export interface EmbeddingProvider {
	generateEmbedding(text: string): Promise<number[] | null>;
	generateEmbeddings(texts: string[]): Promise<Array<number[] | null>>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
	private readonly apiKey: string;
	private readonly model: string;
	private readonly baseUrl: string;

	constructor(apiKey: string, options?: { model?: string; baseUrl?: string }) {
		this.apiKey = apiKey;
		this.model = options?.model ?? "text-embedding-3-small";
		this.baseUrl = options?.baseUrl ?? "https://api.openai.com/v1";
	}

	async generateEmbedding(text: string): Promise<number[] | null> {
		const results = await this.generateEmbeddings([text]);
		return results[0];
	}

	async generateEmbeddings(texts: string[]): Promise<Array<number[] | null>> {
		if (texts.length === 0) return [];

		// Truncate and clean input texts
		const cleaned = texts.map((t) => t.slice(0, 8000).trim()).filter(Boolean);
		if (cleaned.length === 0) return texts.map(() => null);

		try {
			const res = await fetch(`${this.baseUrl}/embeddings`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					input: cleaned,
					model: this.model,
				}),
			});

			if (!res.ok) {
				const err = (await res.json()) as EmbeddingErrorResponse;
				console.error(
					`Embedding API error: ${err.error?.message ?? `HTTP ${res.status}`}`,
				);
				return texts.map(() => null);
			}

			const json = (await res.json()) as EmbeddingResponse;
			const results: Array<number[] | null> = texts.map(() => null);
			for (const item of json.data) {
				if (item.index < cleaned.length) {
					results[item.index] = item.embedding;
				}
			}
			return results;
		} catch (err) {
			console.error("Embedding API request failed:", err);
			return texts.map(() => null);
		}
	}
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}
