"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

interface SettingsData {
	ai: {
		status: "connected" | "not_configured" | "error";
		error?: string;
		configured: boolean;
		provider: "openai" | "openrouter" | null;
		model: string;
		apiKey: string | null;
	};
	embeddingsCount: number;
}

function useRecommendationSettingsApi() {
	const client = useModuleClient();
	return {
		settings:
			client.module("recommendations").admin["/admin/recommendations/settings"],
	};
}

export function RecommendationSettings() {
	const api = useRecommendationSettingsApi();
	const { data, isLoading, error } = api.settings.useQuery({}) as {
		data: SettingsData | undefined;
		isLoading: boolean;
		error: Error | null;
	};

	if (isLoading) {
		return (
			<div>
				<div className="mb-6">
					<h1 className="font-bold text-2xl text-foreground">
						Recommendation Settings
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Configure AI-powered product recommendations.
					</p>
				</div>
				<div className="space-y-4">
					<div className="h-40 animate-pulse rounded-lg border border-border bg-muted/30" />
					<div className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div>
				<div className="mb-6">
					<h1 className="font-bold text-2xl text-foreground">
						Recommendation Settings
					</h1>
				</div>
				<div
					role="alert"
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm"
				>
					Failed to load settings: {error.message}
				</div>
			</div>
		);
	}

	const ai = data?.ai;
	const aiStatus = ai?.status ?? "not_configured";
	const aiConnected = aiStatus === "connected";
	const aiError = aiStatus === "error";
	const providerLabel =
		ai?.provider === "openai"
			? "OpenAI"
			: ai?.provider === "openrouter"
				? "OpenRouter"
				: null;

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">
					Recommendation Settings
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Configure AI-powered product recommendations.
				</p>
			</div>

			<div className="space-y-6">
				{/* AI Embedding Provider */}
				<div className="rounded-lg border border-border bg-card p-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 256 256"
									fill="none"
									className="text-violet-500"
									role="img"
									aria-label="AI embedding provider"
								>
									<path
										d="M176 232a8 8 0 0 1-8 8H88a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8Zm40-128a87.55 87.55 0 0 1-33.64 69.21A16.24 16.24 0 0 0 176 186v6a16 16 0 0 1-16 16H96a16 16 0 0 1-16-16v-6a16 16 0 0 0-6.23-12.66A87.59 87.59 0 0 1 40 104.49C39.74 56.83 78.26 17.14 125.88 16A88 88 0 0 1 216 104Zm-16 0a72 72 0 0 0-73.74-72c-39 .92-70.47 33.39-70.26 72.39a71.65 71.65 0 0 0 27.64 56.3A32 32 0 0 1 96 186v6h24v-44.69l-21.66-21.65a8 8 0 0 1 11.32-11.32L128 132.69l18.34-18.35a8 8 0 0 1 11.32 11.32L136 147.31V192h24v-6a32.12 32.12 0 0 1 12.47-25.35A71.65 71.65 0 0 0 200 104Z"
										fill="currentColor"
									/>
								</svg>
							</div>
							<div>
								<h3 className="font-semibold text-foreground">
									AI Embedding Provider
								</h3>
								<p className="text-muted-foreground text-sm">
									Generate product embeddings for similarity-based
									recommendations
								</p>
							</div>
						</div>
						{aiConnected ? (
							<span
								data-testid="ai-status-connected"
								className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 font-medium text-green-600 text-xs dark:text-green-400"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-green-500" />
								Connected
							</span>
						) : aiError ? (
							<span
								data-testid="ai-status-error"
								className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 font-medium text-red-600 text-xs dark:text-red-400"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-red-500" />
								Connection Error
							</span>
						) : (
							<span
								data-testid="ai-status-not-configured"
								className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 font-medium text-amber-600 text-xs dark:text-amber-400"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
								Not configured
							</span>
						)}
					</div>

					{aiConnected && ai ? (
						<div className="mt-4 grid gap-3 sm:grid-cols-3">
							<div className="rounded-md bg-muted/30 p-3">
								<p className="text-muted-foreground text-xs">Provider</p>
								<p className="mt-0.5 font-medium text-foreground text-sm">
									{providerLabel}
								</p>
							</div>
							<div className="rounded-md bg-muted/30 p-3">
								<p className="text-muted-foreground text-xs">Model</p>
								<p className="mt-0.5 font-mono text-foreground text-sm">
									{ai.model}
								</p>
							</div>
							<div className="rounded-md bg-muted/30 p-3">
								<p className="text-muted-foreground text-xs">API Key</p>
								<p className="mt-0.5 font-mono text-foreground text-sm">
									{ai.apiKey}
								</p>
							</div>
						</div>
					) : aiError ? (
						<div
							data-testid="ai-error-details"
							className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-600 text-sm dark:text-red-400"
						>
							<p className="font-medium">
								{providerLabel ?? "AI provider"} rejected the configured
								credentials.
							</p>
							{ai?.error ? (
								<p className="mt-1 font-mono text-xs opacity-90">{ai.error}</p>
							) : null}
							<p className="mt-2 text-muted-foreground text-xs">
								Verify the key is active and has access to the embedding model,
								then reload this page.
							</p>
						</div>
					) : (
						<p className="mt-3 text-muted-foreground text-sm">
							Set{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
								OPENAI_API_KEY
							</code>{" "}
							or{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
								OPENROUTER_API_KEY
							</code>{" "}
							environment variable to enable AI-powered similarity
							recommendations.
						</p>
					)}
				</div>

				{/* Embeddings Stats */}
				<div className="rounded-lg border border-border bg-card p-6">
					<h3 className="mb-3 font-semibold text-foreground">
						Embeddings Index
					</h3>
					<div className="flex items-baseline gap-2">
						<span className="font-bold text-3xl text-foreground">
							{data?.embeddingsCount ?? 0}
						</span>
						<span className="text-muted-foreground text-sm">
							product embeddings stored
						</span>
					</div>
					{aiConnected ? (
						<p className="mt-2 text-muted-foreground text-sm">
							Product embeddings are generated automatically when products are
							created or updated. Use the{" "}
							<strong className="text-foreground">Generate Embedding</strong>{" "}
							admin endpoint to manually embed specific products.
						</p>
					) : aiError ? (
						<p className="mt-2 text-muted-foreground text-sm">
							New embeddings will not be generated until the provider connection
							above is repaired.
						</p>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							Configure an embedding provider above to start generating product
							embeddings for AI-powered similarity recommendations.
						</p>
					)}
				</div>

				{/* How it works */}
				<div className="rounded-lg border border-border bg-card p-6">
					<h3 className="mb-2 font-semibold text-foreground">
						Recommendation strategies
					</h3>
					<ul className="space-y-2 text-muted-foreground text-sm">
						<li>
							<strong className="text-foreground">Manual</strong> — curated
							rules that map source products to specific recommendations
						</li>
						<li>
							<strong className="text-foreground">Bought Together</strong> —
							co-occurrence analysis from real purchase data
						</li>
						<li>
							<strong className="text-foreground">Trending</strong> — popular
							products based on recent interaction volume
						</li>
						<li>
							<strong className="text-foreground">Personalized</strong> —
							customer-specific recommendations from browsing and purchase
							history
						</li>
						<li>
							<strong className="text-foreground">AI Similar</strong> — when an
							embedding provider is configured, uses vector similarity to find
							related products
						</li>
					</ul>
					<p className="mt-3 text-muted-foreground text-xs">
						Strategies are combined and weighted to produce the final
						recommendation list. AI similarity is used as a fallback when other
						strategies have insufficient data.
					</p>
				</div>
			</div>
		</div>
	);
}
