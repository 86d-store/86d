"use client";

import { useState } from "react";
import {
	extractError,
	slugify,
	type TicketCategory,
	useTicketsApi,
} from "./_shared";

export function TicketCategories() {
	const api = useTicketsApi();
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newSlug, setNewSlug] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [newPosition, setNewPosition] = useState(0);
	const [error, setError] = useState("");

	const { data, isLoading } = api.listCategories.useQuery({}) as {
		data: { categories?: TicketCategory[] } | undefined;
		isLoading: boolean;
	};

	const createMutation = api.createCategory.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteCategory.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const categories = data?.categories ?? [];

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!newName.trim()) {
			setError("Name is required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					name: newName.trim(),
					slug: newSlug.trim() || slugify(newName),
					description: newDescription.trim() || undefined,
					position: newPosition,
				},
			});
			setNewName("");
			setNewSlug("");
			setNewDescription("");
			setNewPosition(0);
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (id: string) => {
		if (
			!confirm(
				"Delete this category? Tickets in this category will be uncategorized.",
			)
		)
			return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
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
						Ticket Categories
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Organize tickets by category
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Create category"}
				</button>
			</div>

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Category
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
									onChange={(e) => {
										setNewName(e.target.value);
										if (!newSlug) {
											setNewSlug(slugify(e.target.value));
										}
									}}
									placeholder="Shipping Issues"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Slug</span>
								<input
									type="text"
									value={newSlug}
									onChange={(e) => setNewSlug(e.target.value)}
									placeholder="shipping-issues"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Description
								</span>
								<input
									type="text"
									value={newDescription}
									onChange={(e) => setNewDescription(e.target.value)}
									placeholder="Optional description"
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
							{createMutation.isPending ? "Creating..." : "Create Category"}
						</button>
					</form>
				</div>
			) : null}

			{/* Category list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : categories.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No categories yet. Create one to organize tickets.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{categories.map((cat) => (
						<div
							key={cat.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<a
											href={`/admin/tickets/categories/${cat.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{cat.name}
										</a>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												cat.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{cat.isActive ? "Active" : "Inactive"}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										Slug: {cat.slug}
										{cat.description ? ` \u00B7 ${cat.description}` : ""}
										{` \u00B7 Position: ${cat.position}`}
									</p>
								</div>
								<div className="flex gap-1">
									<a
										href={`/admin/tickets/categories/${cat.id}`}
										className="rounded px-2 py-1 text-xs hover:bg-muted"
									>
										Edit
									</a>
									<button
										type="button"
										onClick={() => handleDelete(cat.id)}
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
