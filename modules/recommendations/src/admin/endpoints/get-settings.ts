import { createAdminEndpoint } from "@86d-app/core/api";
import type { RecommendationController } from "../../service";

function maskKey(key: string): string {
	if (key.length <= 8) return `${key.slice(0, 2)}••••••`;
	return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 4, 20))}`;
}

interface RecommendationsModuleOptions {
	openaiApiKey?: string;
	openrouterApiKey?: string;
	embeddingModel?: string;
}

async function verifyAiConnection(
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
	"/admin/recommendations/settings",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;
		const options = ctx.context.options as
			| RecommendationsModuleOptions
			| undefined;

		const stats = await controller.getStats();

		const aiConfigured = Boolean(
			options?.openaiApiKey || options?.openrouterApiKey,
		);

		let status: "connected" | "not_configured" | "error" = "not_configured";
		let error: string | undefined;

		if (aiConfigured) {
			const apiKey = options?.openaiApiKey ?? options?.openrouterApiKey ?? "";
			const baseUrl = options?.openrouterApiKey
				? "https://openrouter.ai/api/v1"
				: "https://api.openai.com/v1";
			const result = await verifyAiConnection(apiKey, baseUrl);
			if (result.ok) {
				status = "connected";
			} else {
				status = "error";
				error = result.error;
			}
		}

		return {
			ai: {
				status,
				error,
				configured: aiConfigured,
				provider: options?.openaiApiKey
					? "openai"
					: options?.openrouterApiKey
						? "openrouter"
						: null,
				model: options?.embeddingModel ?? "text-embedding-3-small",
				apiKey: options?.openaiApiKey
					? maskKey(options.openaiApiKey)
					: options?.openrouterApiKey
						? maskKey(options.openrouterApiKey)
						: null,
			},
			embeddingsCount: stats.embeddingsCount,
		};
	},
);
