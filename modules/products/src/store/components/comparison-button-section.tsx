"use client";

import { useState } from "react";
import { useComparisonApi } from "./_hooks";

/**
 * "Add to compare" toggle for the product detail page.
 * Uses the comparisons module API via useModuleClient().
 * Returns null when the comparisons module is not installed.
 */
export function ComparisonButtonSection({
	productId,
	productName,
	productSlug,
	productImage,
	productPrice,
}: {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
}) {
	const api = useComparisonApi();
	const [error, setError] = useState("");

	const listResult = api.listComparison.useQuery({}) as {
		data: { items: Array<{ productId: string }> } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const inComparison =
		listResult.data?.items.some((i) => i.productId === productId) ?? false;

	const invalidate = () => {
		void api.listComparison.invalidate();
	};

	const addMutation = api.addProduct.useMutation({
		onSettled: invalidate,
		onError: () => setError("Failed to add to comparison."),
	});
	const removeMutation = api.removeProduct.useMutation({
		onSettled: invalidate,
		onError: () => setError("Failed to remove from comparison."),
	});

	if (listResult.isError) return null;

	const isPending = addMutation.isPending || removeMutation.isPending;

	const handleToggle = () => {
		setError("");
		if (inComparison) {
			removeMutation.mutate({ productId });
		} else {
			addMutation.mutate({
				productId,
				productName,
				productSlug,
				productImage,
				productPrice,
			});
		}
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleToggle}
				disabled={isPending || listResult.isLoading}
				aria-label={
					inComparison ? "Remove from comparison" : "Add to comparison"
				}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 font-medium text-sm transition-colors ${
					inComparison
						? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
						: "border-border text-foreground/80 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-800 dark:hover:bg-blue-950 dark:hover:text-blue-400"
				} disabled:opacity-50`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<line x1="18" y1="20" x2="18" y2="10" />
					<line x1="12" y1="20" x2="12" y2="4" />
					<line x1="6" y1="20" x2="6" y2="14" />
				</svg>
				{inComparison ? "Added to compare" : "Compare"}
			</button>
			{error && (
				<p className="mt-1 text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
