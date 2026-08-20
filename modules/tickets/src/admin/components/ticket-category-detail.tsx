"use client";

import { useState } from "react";
import {
	extractError,
	slugify,
	type TicketCategory,
	useTicketsApi,
} from "./_shared";

export function TicketCategoryDetail({ params }: { params: { id: string } }) {
	const api = useTicketsApi();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [position, setPosition] = useState(0);
	const [isActive, setIsActive] = useState(true);
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	const { data, isLoading } = api.listCategories.useQuery({}) as {
		data: { categories?: TicketCategory[] } | undefined;
		isLoading: boolean;
	};

	const updateMutation = api.updateCategory.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const categories = data?.categories ?? [];
	const category = categories.find((c) => c.id === params.id);

	if (category && !initialized) {
		setName(category.name);
		setSlug(category.slug);
		setDescription(category.description ?? "");
		setPosition(category.position);
		setIsActive(category.isActive);
		setInitialized(true);
	}

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSaved(false);
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		try {
			await updateMutation.mutateAsync({
				params: { id: params.id },
				body: {
					name: name.trim(),
					slug: slug.trim() || slugify(name),
					description: description.trim() || undefined,
					position,
					isActive,
				},
			});
			setSaved(true);
		} catch (err) {
			setError(extractError(err));
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
				<div className="h-48 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!category) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">Category not found.</p>
				<a
					href="/admin/tickets/categories"
					className="mt-2 inline-block text-sm underline"
				>
					Back to categories
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/tickets/categories"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to categories
				</a>
				<h1 className="mt-2 font-bold text-2xl text-foreground">
					Edit Category
				</h1>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}
			{saved ? (
				<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 text-sm dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
					Category saved successfully.
				</div>
			) : null}

			<form
				onSubmit={handleSave}
				className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-5"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Name</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Slug</span>
						<input
							type="text"
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<label className="block">
					<span className="mb-1 block font-medium text-sm">Description</span>
					<input
						type="text"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional description"
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					/>
				</label>
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Position</span>
						<input
							type="number"
							value={position}
							onChange={(e) =>
								setPosition(Number.parseInt(e.target.value, 10) || 0)
							}
							min={0}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
					<label className="flex items-center gap-2 self-end pb-2">
						<input
							type="checkbox"
							checked={isActive}
							onChange={(e) => setIsActive(e.target.checked)}
							className="rounded border-border"
						/>
						<span className="font-medium text-sm">Active</span>
					</label>
				</div>
				<button
					type="submit"
					disabled={updateMutation.isPending}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
				>
					{updateMutation.isPending ? "Saving..." : "Save Changes"}
				</button>
			</form>
		</div>
	);
}
