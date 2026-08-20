"use client";

import { useState } from "react";
import { useBackordersApi } from "./_hooks";

/**
 * Shows a backorder option when a product is sold out but backordering is allowed.
 * Returns null when the backorders module is not installed or the product isn't eligible.
 */
export function BackorderSection({
	productId,
	productName,
	variantId,
	variantLabel,
}: {
	productId: string;
	productName: string;
	variantId?: string | undefined;
	variantLabel?: string | undefined;
}) {
	const api = useBackordersApi();
	const [qty] = useState(1);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	const checkResult = api.checkEligibility.useQuery(
		{ params: { productId }, ...(variantId ? { quantity: qty } : {}) },
		{ enabled: !!productId },
	) as {
		data: { eligible: boolean; estimatedDays?: number | null } | undefined;
		isError: boolean;
	};

	const createMutation = api.createBackorder.useMutation({
		onSuccess: () => setSuccess(true),
		onError: () => setError("Failed to place backorder. Please try again."),
	});

	if (checkResult.isError || !checkResult.data?.eligible) return null;

	if (success) {
		return (
			<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
				<p className="font-medium text-emerald-700 text-sm dark:text-emerald-400">
					Backorder placed!
				</p>
				<p className="mt-0.5 text-emerald-600 text-xs dark:text-emerald-500">
					We&apos;ll fulfill your order as soon as stock is available.
				</p>
			</div>
		);
	}

	const estDays = checkResult.data.estimatedDays;

	return (
		<div className="rounded-md border border-border p-3">
			<div className="mb-2">
				<p className="font-medium text-foreground text-sm">
					Available on Backorder
				</p>
				{estDays != null && (
					<p className="mt-0.5 text-muted-foreground text-xs">
						Estimated: {estDays} business day{estDays !== 1 ? "s" : ""}
					</p>
				)}
			</div>
			<button
				type="button"
				onClick={() =>
					createMutation.mutate({
						productId,
						productName,
						variantId,
						variantLabel,
						quantity: qty,
					})
				}
				disabled={createMutation.isPending}
				className="w-full rounded-md border border-foreground/30 py-2.5 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:opacity-50"
			>
				{createMutation.isPending ? "Placing backorder..." : "Place backorder"}
			</button>
			{error && (
				<p className="mt-1.5 text-destructive text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
