/**
 * Embedding provider for AI-powered product recommendations.
 *
 * Calls OpenAI / OpenRouter text-embedding-3-small to generate vector
 * embeddings for products.  When configured, the "ai_similar" strategy
 * ranks related products by cosine similarity between their embeddings.
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

		// Track each non-empty input's original position so the API response
		// indices (which reference the submitted `input` array) can be mapped
		// back to the caller's `texts` array. Without this, inputs that were
		// dropped by the blank-filter would shift every later embedding one
		// slot to the left, and products with empty descriptions would be
		// recommended as similar to the wrong products.
		const entries: Array<{ originalIndex: number; text: string }> = [];
		for (let i = 0; i < texts.length; i++) {
			const trimmed = texts[i].slice(0, 8000).trim();
			if (trimmed) {
				entries.push({ originalIndex: i, text: trimmed });
			}
		}
		if (entries.length === 0) return texts.map(() => null);

		try {
			const res = await fetch(`${this.baseUrl}/embeddings`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					input: entries.map((e) => e.text),
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
				const entry = entries[item.index];
				if (entry) {
					results[entry.originalIndex] = item.embedding;
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
