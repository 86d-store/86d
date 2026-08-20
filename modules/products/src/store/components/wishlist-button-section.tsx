"use client";

import { useState } from "react";
import { useWishlistApi } from "./_hooks";

function HeartIconSvg({ filled }: { filled: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill={filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
		</svg>
	);
}

/**
 * Wishlist toggle button for the product detail page.
 * Uses the wishlist module API via useModuleClient() to check and toggle status.
 * Returns null when the wishlist module is not installed or if there's an API error.
 */
export function WishlistButtonSection({
	productId,
	productName,
	productImage,
}: {
	productId: string;
	productName: string;
	productImage?: string | undefined;
}) {
	const api = useWishlistApi();
	const [error, setError] = useState("");

	const checkResult = api.checkWishlist.useQuery(
		{ params: { productId } },
		{ enabled: !!productId },
	) as {
		data: { inWishlist: boolean; itemId: string | null } | undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const inWishlist = checkResult.data?.inWishlist ?? false;
	const itemId = checkResult.data?.itemId ?? null;

	const invalidate = () => {
		void api.checkWishlist.invalidate();
	};

	const addMutation = api.addToWishlist.useMutation({
		onSettled: invalidate,
		onError: () => setError("Failed to save."),
	});
	const removeMutation = api.removeFromWishlist.useMutation({
		onSettled: invalidate,
		onError: () => setError("Failed to remove."),
	});

	if (checkResult.isError) return null;

	const isPending = addMutation.isPending || removeMutation.isPending;

	const handleToggle = () => {
		setError("");
		if (inWishlist && itemId) {
			removeMutation.mutate({ params: { id: itemId } });
		} else {
			addMutation.mutate({ productId, productName, productImage });
		}
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleToggle}
				disabled={isPending || checkResult.isLoading}
				aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 font-medium text-sm transition-colors ${
					inWishlist
						? "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
						: "border-border text-foreground/80 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400"
				} disabled:opacity-50`}
			>
				<HeartIconSvg filled={inWishlist} />
				{inWishlist ? "Saved" : "Save"}
			</button>
			{error && (
				<p className="mt-1 text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
