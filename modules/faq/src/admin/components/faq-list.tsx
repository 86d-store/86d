"use client";

import { useState } from "react";
import {
	extractError,
	type FaqCategory,
	type FaqItem,
	slugify,
	useFaqApi,
} from "./_shared";

interface FaqStats {
	totalCategories: number;
	totalItems: number;
	totalHelpful: number;
	totalNotHelpful: number;
}

export function FaqList() {
	const api = useFaqApi();
	const [categoryFilter, setCategoryFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	// Form state
	const [newQuestion, setNewQuestion] = useState("");
	const [newAnswer, setNewAnswer] = useState("");
	const [newSlug, setNewSlug] = useState("");
	const [newCategoryId, setNewCategoryId] = useState("");
	const [newTags, setNewTags] = useState("");
	const [newPosition, setNewPosition] = useState(0);
	const [error, setError] = useState("");

	const { data, isLoading } = api.listItems.useQuery({
		...(categoryFilter ? { categoryId: categoryFilter } : {}),
	}) as {
		data: { items?: FaqItem[] } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: FaqStats } | undefined;
	};
	const { data: catData } = api.listCategories.useQuery({}) as {
		data: { categories?: FaqCategory[] } | undefined;
	};

	const items = data?.items ?? [];
	const stats = statsData?.stats;
	const categories = catData?.categories ?? [];

	const createMutation = api.createItem.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteItem.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!newQuestion.trim() || !newAnswer.trim() || !newCategoryId) {
			setError("Question, answer, and category are required.");
			return;
		}
		const tags = newTags
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		try {
			await createMutation.mutateAsync({
				body: {
					categoryId: newCategoryId,
					question: newQuestion.trim(),
					answer: newAnswer.trim(),
					slug: newSlug.trim() || slugify(newQuestion),
					position: newPosition,
					...(tags.length > 0 ? { tags } : {}),
				},
			});
			setNewQuestion("");
			setNewAnswer("");
			setNewSlug("");
			setNewCategoryId("");
			setNewTags("");
			setNewPosition(0);
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this FAQ item?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">FAQ</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage frequently asked questions
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Add question"}
				</button>
			</div>

			{/* Stats */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Categories
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalCategories}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Questions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalItems}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Helpful Votes
						</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{stats.totalHelpful}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Not Helpful
						</p>
						<p className="mt-1 font-bold text-2xl text-red-600">
							{stats.totalNotHelpful}
						</p>
					</div>
				</div>
			) : null}

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New FAQ Item
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Category</span>
								<select
									value={newCategoryId}
									onChange={(e) => setNewCategoryId(e.target.value)}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<option value="">Select category</option>
									{categories.map((cat) => (
										<option key={cat.id} value={cat.id}>
											{cat.name}
										</option>
									))}
								</select>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Slug</span>
								<input
									type="text"
									value={newSlug}
									onChange={(e) => setNewSlug(e.target.value)}
									placeholder="Auto-generated from question"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Question</span>
							<input
								type="text"
								value={newQuestion}
								onChange={(e) => {
									setNewQuestion(e.target.value);
									if (!newSlug) {
										setNewSlug(slugify(e.target.value));
									}
								}}
								placeholder="How do I track my order?"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Answer</span>
							<textarea
								value={newAnswer}
								onChange={(e) => setNewAnswer(e.target.value)}
								placeholder="Provide a clear answer..."
								rows={4}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Tags (comma-separated)
								</span>
								<input
									type="text"
									value={newTags}
									onChange={(e) => setNewTags(e.target.value)}
									placeholder="shipping, tracking, delivery"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Position</span>
								<input
									type="number"
									value={newPosition}
									onChange={(e) =>
										setNewPosition(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Question"}
						</button>
					</form>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4 flex gap-2">
				<select
					value={categoryFilter}
					onChange={(e) => setCategoryFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
				>
					<option value="">All categories</option>
					{categories.map((cat) => (
						<option key={cat.id} value={cat.id}>
							{cat.name}
						</option>
					))}
				</select>
			</div>

			{/* Item list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2", "k3"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : items.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No FAQ items yet. Add a question to get started.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{items.map((item) => (
						<div
							key={item.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<a
											href={`/admin/faq/${item.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{item.question}
										</a>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												item.isVisible
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{item.isVisible ? "Visible" : "Hidden"}
										</span>
									</div>
									<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
										{item.answer}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{categoryMap.get(item.categoryId) ?? "Uncategorized"}
										{` \u00B7 Position: ${item.position}`}
										{` \u00B7 \u{1F44D} ${item.helpfulCount} \u{1F44E} ${item.notHelpfulCount}`}
										{item.tags && item.tags.length > 0
											? ` \u00B7 ${item.tags.join(", ")}`
											: ""}
									</p>
								</div>
								<div className="flex gap-1">
									<a
										href={`/admin/faq/${item.id}`}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										Edit
									</a>
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
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
