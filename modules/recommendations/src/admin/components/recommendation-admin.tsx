"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

function useRecommendationsApi() {
	const client = useModuleClient();
	return {
		listRules:
			client.module("recommendations").admin["/admin/recommendations/rules"],
		createRule:
			client.module("recommendations").admin[
				"/admin/recommendations/rules/create"
			],
		updateRule:
			client.module("recommendations").admin[
				"/admin/recommendations/rules/:id"
			],
		deleteRule:
			client.module("recommendations").admin[
				"/admin/recommendations/rules/:id/delete"
			],
		stats:
			client.module("recommendations").admin["/admin/recommendations/stats"],
	};
}

interface RecommendationRule {
	id: string;
	name: string;
	strategy: string;
	sourceProductId?: string;
	targetProductIds: string[];
	weight: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface RecommendationStats {
	totalRules: number;
	activeRules: number;
	totalCoOccurrences: number;
	totalInteractions: number;
	totalImpressions: number;
	totalClicks: number;
	clickThroughRate: number;
	avgClickPosition: number;
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

const STRATEGY_COLORS: Record<string, string> = {
	manual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	bought_together:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	trending:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	personalized:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STRATEGY_LABELS: Record<string, string> = {
	manual: "Manual",
	bought_together: "Bought Together",
	trending: "Trending",
	personalized: "Personalized",
};

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function RecommendationAdmin() {
	const api = useRecommendationsApi();
	const [strategyFilter, setStrategyFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	const { data, isLoading } = api.listRules.useQuery({
		...(strategyFilter ? { strategy: strategyFilter } : {}),
	}) as {
		data: { rules?: RecommendationRule[]; total?: number } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: RecommendationStats } | undefined;
	};

	const rules = data?.rules ?? [];
	const stats = statsData?.stats;

	// Create rule state
	const [newName, setNewName] = useState("");
	const [newStrategy, setNewStrategy] = useState("manual");
	const [newSourceProductId, setNewSourceProductId] = useState("");
	const [newTargetProductIds, setNewTargetProductIds] = useState("");
	const [newWeight, setNewWeight] = useState(10);
	const [error, setError] = useState("");

	const createMutation = api.createRule.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const updateMutation = api.updateRule.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteRule.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const targets = newTargetProductIds
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (!newName.trim() || targets.length === 0) {
			setError("Name and at least one target product ID are required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					name: newName.trim(),
					strategy: newStrategy,
					sourceProductId: newSourceProductId.trim() || undefined,
					targetProductIds: targets,
					weight: newWeight,
					isActive: true,
				},
			});
			setNewName("");
			setNewSourceProductId("");
			setNewTargetProductIds("");
			setNewWeight(10);
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleToggleActive = async (rule: RecommendationRule) => {
		try {
			await updateMutation.mutateAsync({
				params: { id: rule.id },
				body: { isActive: !rule.isActive },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleDelete = async (ruleId: string) => {
		if (!confirm("Delete this recommendation rule?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id: ruleId } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">
						Recommendations
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage product recommendation rules, co-occurrence data, and
						personalization
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Create rule"}
				</button>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Rules
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalRules}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Active Rules
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.activeRules}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Co-occurrences
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalCoOccurrences}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Interactions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalInteractions}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Impressions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalImpressions.toLocaleString()}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Clicks
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalClicks.toLocaleString()}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Click-Through Rate
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{`${stats.clickThroughRate}%`}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Avg Click Position
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.avgClickPosition > 0 ? stats.avgClickPosition : "—"}
						</p>
					</div>
				</div>
			) : null}

			{/* Create rule form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Recommendation Rule
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Name</span>
								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="Summer Cross-sell"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Strategy</span>
								<select
									value={newStrategy}
									onChange={(e) => setNewStrategy(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="manual">Manual</option>
									<option value="bought_together">Bought Together</option>
									<option value="trending">Trending</option>
									<option value="personalized">Personalized</option>
								</select>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Source Product ID
								</span>
								<input
									type="text"
									value={newSourceProductId}
									onChange={(e) => setNewSourceProductId(e.target.value)}
									placeholder="Optional — triggers when viewing this product"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Weight (0–100)
								</span>
								<input
									type="number"
									value={newWeight}
									onChange={(e) =>
										setNewWeight(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									max={100}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Target Product IDs (comma-separated)
							</span>
							<input
								type="text"
								value={newTargetProductIds}
								onChange={(e) => setNewTargetProductIds(e.target.value)}
								placeholder="prod_1, prod_2, prod_3"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Rule"}
						</button>
					</form>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4 flex gap-2">
				<select
					value={strategyFilter}
					onChange={(e) => setStrategyFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All strategies</option>
					<option value="manual">Manual</option>
					<option value="bought_together">Bought Together</option>
					<option value="trending">Trending</option>
					<option value="personalized">Personalized</option>
				</select>
			</div>

			{/* Rules list */}
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : rules.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No recommendation rules yet. Create one to start recommending
						products.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{rules.map((rule) => (
						<div
							key={rule.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{rule.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STRATEGY_COLORS[rule.strategy] ?? "bg-muted text-muted-foreground"}`}
										>
											{STRATEGY_LABELS[rule.strategy] ?? rule.strategy}
										</span>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												rule.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{rule.isActive ? "Active" : "Inactive"}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										Weight: {rule.weight}
										{rule.sourceProductId
											? ` · Source: ${rule.sourceProductId}`
											: ""}
										{` · ${rule.targetProductIds.length} target(s)`}
										{` · ${formatDate(rule.createdAt)}`}
									</p>
								</div>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => handleToggleActive(rule)}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										{rule.isActive ? "Deactivate" : "Activate"}
									</button>
									<button
										type="button"
										onClick={() => handleDelete(rule.id)}
										className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
