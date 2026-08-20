import { createAdminEndpoint } from "@86d-app/core/api";
import { MeiliSearchProvider } from "../../meilisearch-provider";
import type { SearchController } from "../../service";

function maskKey(key: string): string {
	if (key.length <= 8) return `${key.slice(0, 2)}••••••`;
	return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 4, 20))}`;
}

interface SearchModuleOptions {
	meilisearchHost?: string;
	meilisearchApiKey?: string;
	meilisearchIndexUid?: string;
	openaiApiKey?: string;
	openrouterApiKey?: string;
	embeddingModel?: string;
}

async function verifyEmbeddingConnection(
	apiKey: string,
	baseUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch(`${baseUrl}/models`, {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (res.ok) {
			return { ok: true };
		}
		const text = await res.text().catch(() => "");
		return {
			ok: false,
			error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Connection failed",
		};
	}
}

export const getSettings = createAdminEndpoint(
	"/admin/search/settings",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const options = ctx.context.options as SearchModuleOptions | undefined;

		const meilisearchConfigured = Boolean(
			options?.meilisearchHost && options?.meilisearchApiKey,
		);

		const embeddingConfigured = Boolean(
			options?.openaiApiKey || options?.openrouterApiKey,
		);

		let meilisearchStatus: "connected" | "not_configured" | "error" =
			"not_configured";
		let meilisearchError: string | undefined;
		let documentCount: number | undefined;

		if (
			meilisearchConfigured &&
			options?.meilisearchHost &&
			options.meilisearchApiKey
		) {
			const provider = new MeiliSearchProvider(
				options.meilisearchHost,
				options.meilisearchApiKey,
				options.meilisearchIndexUid,
			);
			const healthy = await provider.isHealthy();
			if (healthy) {
				meilisearchStatus = "connected";
				const stats = await provider.getStats();
				if (stats) {
					documentCount = stats.numberOfDocuments;
				}
			} else {
				meilisearchStatus = "error";
				meilisearchError = "MeiliSearch instance is not reachable";
			}
		}

		let embeddingStatus: "connected" | "not_configured" | "error" =
			"not_configured";
		let embeddingError: string | undefined;

		if (embeddingConfigured) {
			const apiKey = options?.openaiApiKey ?? options?.openrouterApiKey ?? "";
			const baseUrl = options?.openrouterApiKey
				? "https://openrouter.ai/api/v1"
				: "https://api.openai.com/v1";
			const result = await verifyEmbeddingConnection(apiKey, baseUrl);
			if (result.ok) {
				embeddingStatus = "connected";
			} else {
				embeddingStatus = "error";
				embeddingError = result.error;
			}
		}

		const indexCount = await controller.getIndexCount();

		return {
			meilisearch: {
				status: meilisearchStatus,
				error: meilisearchError,
				configured: meilisearchConfigured,
				host: options?.meilisearchHost ?? null,
				apiKey: options?.meilisearchApiKey
					? maskKey(options.meilisearchApiKey)
					: null,
				indexUid: options?.meilisearchIndexUid ?? "search",
				documentCount,
			},
			embeddings: {
				status: embeddingStatus,
				error: embeddingError,
				configured: embeddingConfigured,
				provider: options?.openaiApiKey
					? "openai"
					: options?.openrouterApiKey
						? "openrouter"
						: null,
				model: options?.embeddingModel ?? "text-embedding-3-small",
			},
			indexCount,
		};
	},
);
