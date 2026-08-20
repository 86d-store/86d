"use client";

import { useState } from "react";
import {
	extractError,
	type FaqCategory,
	type FaqItem,
	slugify,
	useFaqApi,
} from "./_shared";

export function FaqDetail({ params }: { params: { id: string } }) {
	const api = useFaqApi();
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [slug, setSlug] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [position, setPosition] = useState(0);
	const [isVisible, setIsVisible] = useState(true);
	const [tags, setTags] = useState("");
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	const { data, isLoading } = api.getItem.useQuery({
		params: { id: params.id },
	}) as {
		data: { item?: FaqItem; error?: string } | undefined;
		isLoading: boolean;
	};
	const { data: catData } = api.listCategories.useQuery({}) as {
		data: { categories?: FaqCategory[] } | undefined;
	};

	const updateMutation = api.updateItem.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const item = data?.item;
	const categories = catData?.categories ?? [];

	if (item && !initialized) {
		setQuestion(item.question);
		setAnswer(item.answer);
		setSlug(item.slug);
		setCategoryId(item.categoryId);
		setPosition(item.position);
		setIsVisible(item.isVisible);
		setTags(item.tags?.join(", ") ?? "");
		setInitialized(true);
	}

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSaved(false);
		if (!question.trim() || !answer.trim()) {
			setError("Question and answer are required.");
			return;
		}
		const parsedTags = tags
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		try {
			await updateMutation.mutateAsync({
				params: { id: params.id },
				body: {
					question: question.trim(),
					answer: answer.trim(),
					slug: slug.trim() || slugify(question),
					categoryId,
					position,
					isVisible,
					...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
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
				<div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
			</div>
		);
	}

	if (!item) {
		return (
			<div className="rounded-lg border border-border bg-card p-8 text-center">
				<p className="text-muted-foreground text-sm">FAQ item not found.</p>
				<a href="/admin/faq" className="mt-2 inline-block text-sm underline">
					Back to FAQ
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/faq"
					className="text-muted-foreground text-sm hover:underline"
				>
					&larr; Back to FAQ
				</a>
				<h1 className="mt-2 font-bold text-2xl text-foreground">
					Edit FAQ Item
				</h1>
			</div>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}
			{saved ? (
				<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 text-sm dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
					FAQ item saved successfully.
				</div>
			) : null}

			<form
				onSubmit={handleSave}
				className="max-w-3xl space-y-4 rounded-lg border border-border bg-card p-5"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">Category</span>
						<select
							value={categoryId}
							onChange={(e) => setCategoryId(e.target.value)}
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
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<label className="block">
					<span className="mb-1 block font-medium text-sm">Question</span>
					<input
						type="text"
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block font-medium text-sm">Answer</span>
					<textarea
						value={answer}
						onChange={(e) => setAnswer(e.target.value)}
						rows={6}
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					/>
				</label>
				<div className="grid gap-4 sm:grid-cols-3">
					<label className="block">
						<span className="mb-1 block font-medium text-sm">
							Tags (comma-separated)
						</span>
						<input
							type="text"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						/>
					</label>
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
							checked={isVisible}
							onChange={(e) => setIsVisible(e.target.checked)}
							className="rounded border-border"
						/>
						<span className="font-medium text-sm">Visible</span>
					</label>
				</div>
				<div className="flex items-center gap-4">
					<button
						type="submit"
						disabled={updateMutation.isPending}
						className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
					>
						{updateMutation.isPending ? "Saving..." : "Save Changes"}
					</button>
					<span className="text-muted-foreground text-xs">
						Helpful: {item.helpfulCount} / Not helpful: {item.notHelpfulCount}
					</span>
				</div>
			</form>
		</div>
	);
}
